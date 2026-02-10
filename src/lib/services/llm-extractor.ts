import OpenAI from 'openai';
import * as cheerio from 'cheerio';
import type {
  ColumnSchema,
  LLMAnalysisResult,
  LLMColumnAnalysis,
  LLMCaptureConfig,
  LLMColumnMapping,
} from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

/**
 * LLM-based extraction service using structured output
 */
export class LLMExtractor {
  private model: string;

  constructor(model?: string) {
    this.model = model || DEFAULT_MODEL;
  }

  /**
   * Step 1: Analyze a page to determine what database column data is available
   */
  async analyzePage(
    html: string,
    columns: ColumnSchema[],
    targetTable: string,
    pageUrl: string
  ): Promise<{ columns: LLMColumnAnalysis[]; pageTitle: string }> {
    const $ = cheerio.load(html);
    const pageTitle = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';

    // Get a cleaned text representation of the page (limit size for LLM context)
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 8000);

    // Get the main content HTML (trimmed for context)
    const mainContent = $('main, article, .content, #content, [role="main"]').first().html()
      || $('body').html() || '';
    const trimmedHtml = mainContent.substring(0, 12000);

    const columnsDescription = columns.map(col =>
      `- ${col.name} (${col.type}${col.nullable ? ', nullable' : ''}${col.isPrimaryKey ? ', PRIMARY KEY' : ''}${col.defaultValue ? `, default: ${col.defaultValue}` : ''})`
    ).join('\n');

    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a web data extraction analyst. Given an HTML page and a database table schema, analyze whether data for each database column can be found on the page.

For each column, determine:
1. Whether the data is available on the page
2. Your confidence (0-1) that the data can be reliably extracted
3. A sample value found on the page (if available)
4. Brief reasoning for your assessment
5. A hint about where/how the data appears on the page

Skip auto-increment primary keys and timestamp columns (created_at, updated_at) — mark them as unavailable with reasoning "Auto-generated column".

Return your analysis as JSON:
{
  "columns": [
    {
      "columnName": "title",
      "columnType": "TEXT",
      "isAvailable": true,
      "confidence": 0.95,
      "sampleValue": "Example Title Found",
      "reasoning": "Page heading contains the title text",
      "extractionHint": "Found in the h1 tag within the main content area"
    }
  ]
}`,
          },
          {
            role: 'user',
            content: `Target database table: ${targetTable}

Database columns:
${columnsDescription}

Page URL: ${pageUrl}
Page title: ${pageTitle}

Page text content (excerpt):
${bodyText}

Page HTML (excerpt):
${trimmedHtml}

Analyze each database column and determine if the data can be extracted from this page.`,
          },
        ],
        max_tokens: 3000,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const result = JSON.parse(content);
        const analysisColumns: LLMColumnAnalysis[] = (result.columns || []).map((col: LLMColumnAnalysis) => ({
          columnName: col.columnName,
          columnType: col.columnType || columns.find(c => c.name === col.columnName)?.type || 'TEXT',
          isAvailable: col.isAvailable || false,
          confidence: Math.min(1, Math.max(0, col.confidence || 0)),
          sampleValue: col.sampleValue,
          reasoning: col.reasoning || '',
          extractionHint: col.extractionHint,
        }));

        // Ensure all columns are represented
        for (const col of columns) {
          if (!analysisColumns.find(a => a.columnName === col.name)) {
            analysisColumns.push({
              columnName: col.name,
              columnType: col.type,
              isAvailable: false,
              confidence: 0,
              reasoning: 'Not analyzed',
            });
          }
        }

        return { columns: analysisColumns, pageTitle };
      }
    } catch (error) {
      console.error('LLM page analysis failed:', error);
    }

    // Fallback: mark all columns as unknown
    return {
      pageTitle,
      columns: columns.map(col => ({
        columnName: col.name,
        columnType: col.type,
        isAvailable: false,
        confidence: 0,
        reasoning: 'LLM analysis failed',
      })),
    };
  }

  /**
   * Step 2: Create a structured capture configuration from analysis results
   */
  async createCaptureConfig(
    analysisColumns: LLMColumnAnalysis[],
    targetTable: string,
    pageUrl: string,
    html: string
  ): Promise<LLMCaptureConfig> {
    // Only include columns that are available on the page
    const availableColumns = analysisColumns.filter(c => c.isAvailable && c.confidence > 0);

    // Build JSON schema for structured output
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    const columnMappings: LLMColumnMapping[] = [];

    for (const col of availableColumns) {
      const jsonField = col.columnName;
      const jsonType = this.mapDbTypeToJsonType(col.columnType);

      properties[jsonField] = {
        type: jsonType === 'null' ? 'string' : jsonType,
        description: `${col.columnName} - ${col.extractionHint || col.reasoning}`,
      };

      if (col.confidence >= 0.7) {
        required.push(jsonField);
      }

      columnMappings.push({
        columnName: col.columnName,
        jsonField,
        description: col.extractionHint || col.reasoning,
        dataType: col.columnType,
        isRequired: col.confidence >= 0.7,
      });
    }

    const jsonSchema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: `Array of extracted ${targetTable} records from the page`,
          items: {
            type: 'object',
            properties,
            required,
          },
        },
      },
      required: ['items'],
    };

    // Generate a focused system prompt using AI
    const columnsList = availableColumns.map(c =>
      `- ${c.columnName} (${c.columnType}): ${c.extractionHint || c.reasoning}${c.sampleValue ? ` [example: "${c.sampleValue}"]` : ''}`
    ).join('\n');

    let systemPrompt: string;

    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `Generate a concise system prompt for an LLM that will extract structured data from web pages. The prompt should instruct the LLM to:
1. Extract all matching records from the HTML
2. Return data as a JSON array called "items"
3. Handle missing/partial data gracefully
4. Clean and normalize extracted values

Return only the system prompt text, nothing else.`,
          },
          {
            role: 'user',
            content: `Target table: ${targetTable}
Source URL pattern: ${pageUrl}

Columns to extract:
${columnsList}

Generate a system prompt for extracting this data from similar HTML pages.`,
          },
        ],
        max_tokens: 800,
        temperature: 0.3,
      });

      systemPrompt = response.choices[0]?.message?.content || this.getDefaultSystemPrompt(targetTable, availableColumns);
    } catch {
      systemPrompt = this.getDefaultSystemPrompt(targetTable, availableColumns);
    }

    return {
      systemPrompt,
      jsonSchema,
      columnMappings,
      model: this.model,
      temperature: 0.1,
    };
  }

  /**
   * Runtime: Extract data from HTML using a structured capture config
   */
  async extractWithStructuredOutput(
    html: string,
    config: LLMCaptureConfig,
    pageUrl: string
  ): Promise<Record<string, unknown>[]> {
    const $ = cheerio.load(html);

    // Get cleaned content for LLM
    const mainContent = $('main, article, .content, #content, [role="main"]').first().html()
      || $('body').html() || '';
    const trimmedHtml = mainContent.substring(0, 15000);
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 10000);

    try {
      const response = await openai.chat.completions.create({
        model: config.model || this.model,
        messages: [
          {
            role: 'system',
            content: config.systemPrompt,
          },
          {
            role: 'user',
            content: `Extract data from this web page.

URL: ${pageUrl}

Page text:
${bodyText}

Page HTML:
${trimmedHtml}

Return the extracted data as JSON matching the schema with an "items" array.`,
          },
        ],
        max_tokens: 4000,
        temperature: config.temperature || 0.1,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const result = JSON.parse(content);
        const items = result.items || [];

        // Validate and clean items against column mappings
        return items.map((item: Record<string, unknown>) => {
          const cleaned: Record<string, unknown> = {};
          for (const mapping of config.columnMappings) {
            const value = item[mapping.jsonField];
            if (value !== undefined && value !== null) {
              cleaned[mapping.columnName] = value;
            } else if (mapping.isRequired) {
              cleaned[mapping.columnName] = null;
            }
          }
          return cleaned;
        }).filter((row: Record<string, unknown>) => Object.keys(row).length > 0);
      }
    } catch (error) {
      console.error('LLM extraction failed:', error);
    }

    return [];
  }

  /**
   * Map database types to JSON schema types
   */
  private mapDbTypeToJsonType(dbType: string): string {
    const lower = dbType.toLowerCase();
    if (lower.includes('int') || lower.includes('float') || lower.includes('decimal') ||
        lower.includes('numeric') || lower.includes('real') || lower.includes('double')) {
      return 'number';
    }
    if (lower.includes('bool')) {
      return 'boolean';
    }
    return 'string';
  }

  /**
   * Generate a default system prompt when AI generation fails
   */
  private getDefaultSystemPrompt(targetTable: string, columns: LLMColumnAnalysis[]): string {
    const columnList = columns.map(c => `  - ${c.columnName} (${c.columnType})`).join('\n');
    return `You are a web data extraction expert. Extract structured data from HTML pages for the "${targetTable}" database table.

Extract the following fields:
${columnList}

Instructions:
- Return a JSON object with an "items" array containing all extracted records
- Each item should have the column names as keys
- Clean and normalize values (trim whitespace, parse numbers, format dates)
- If a field is not found for a record, omit it or set to null
- Extract ALL matching records found on the page`;
  }
}

/**
 * Create a default LLM extractor instance
 */
export function createLLMExtractor(): LLMExtractor {
  return new LLMExtractor();
}
