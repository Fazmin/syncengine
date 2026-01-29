import OpenAI from 'openai';
import {
  DatabaseSchema,
  TableSchema,
  ColumnSchema,
  WebsiteStructure,
  MappingSuggestion,
  DetectedField,
  TransformType,
  DataType,
} from '@/types';
import { TableInfo, ColumnInfo } from './database-connector';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

/**
 * AI Mapping Service for intelligent field mapping suggestions
 */
export class AIMapper {
  private model: string;

  constructor(model?: string) {
    this.model = model || DEFAULT_MODEL;
  }

  /**
   * Analyze database structure and produce a schema representation
   */
  async analyzeDatabase(tables: TableInfo[]): Promise<DatabaseSchema> {
    const tableSchemas: TableSchema[] = tables.map(table => ({
      name: table.table,
      schema: table.schema,
      columns: table.columns.map(col => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable,
        isPrimaryKey: col.isPrimaryKey,
        defaultValue: col.defaultValue,
      })),
      primaryKeys: table.columns.filter(c => c.isPrimaryKey).map(c => c.name),
    }));

    return { tables: tableSchemas };
  }

  /**
   * Generate AI-enhanced description of the database schema
   */
  async describeDatabase(schema: DatabaseSchema): Promise<string> {
    const schemaDescription = schema.tables.map(table => {
      const columns = table.columns.map(col => 
        `  - ${col.name} (${col.type}${col.nullable ? ', nullable' : ''}${col.isPrimaryKey ? ', PK' : ''})`
      ).join('\n');
      return `Table: ${table.schema}.${table.name}\n${columns}`;
    }).join('\n\n');

    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a database analyst. Provide a concise description of the database schema, including what kind of data it likely stores and the relationships between tables.',
          },
          {
            role: 'user',
            content: `Analyze this database schema:\n\n${schemaDescription}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.3,
      });

      return response.choices[0]?.message?.content || 'Unable to analyze database schema.';
    } catch (error) {
      console.error('AI analysis failed:', error);
      return 'AI analysis unavailable. Please review the schema manually.';
    }
  }

  /**
   * Suggest mappings between website fields and database columns
   */
  async suggestMappings(
    dbSchema: DatabaseSchema,
    webStructure: WebsiteStructure,
    targetTable?: string
  ): Promise<MappingSuggestion[]> {
    const suggestions: MappingSuggestion[] = [];

    // Get all detected fields from repeating elements
    const webFields: DetectedField[] = webStructure.repeatingElements
      .flatMap(element => element.fields);

    if (webFields.length === 0) {
      return suggestions;
    }

    // Filter to target table if specified
    const tables = targetTable
      ? dbSchema.tables.filter(t => t.name === targetTable)
      : dbSchema.tables;

    // Prepare data for AI
    const webFieldsDescription = webFields.map(f => 
      `- ${f.name}: "${f.sampleValue}" (type: ${f.dataType}, selector: ${f.selector})`
    ).join('\n');

    const dbTablesDescription = tables.map(table => {
      const columns = table.columns.map(col => 
        `  - ${col.name} (${col.type}${col.nullable ? ', nullable' : ''})`
      ).join('\n');
      return `Table: ${table.name}\n${columns}`;
    }).join('\n\n');

    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a data mapping expert. Given website fields with sample values and database columns, suggest mappings between them.
            
For each mapping, provide:
1. The web field name
2. The target table and column
3. A confidence score (0-1)
4. Any transformation needed (trim, regex, date, number, or none)

Return your response as a JSON array of objects with this structure:
{
  "mappings": [
    {
      "webFieldName": "field_name",
      "tableName": "table_name",
      "columnName": "column_name",
      "confidence": 0.9,
      "transformType": "trim",
      "transformConfig": null,
      "reasoning": "Brief explanation"
    }
  ]
}

Only suggest mappings where there's a reasonable semantic match. Don't force mappings.`,
          },
          {
            role: 'user',
            content: `Website fields detected:\n${webFieldsDescription}\n\nDatabase schema:\n${dbTablesDescription}\n\nSuggest field mappings.`,
          },
        ],
        max_tokens: 2000,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const result = JSON.parse(content);
        
        for (const mapping of result.mappings || []) {
          const webField = webFields.find(f => f.name === mapping.webFieldName);
          const table = tables.find(t => t.name === mapping.tableName);
          const column = table?.columns.find(c => c.name === mapping.columnName);

          if (webField && column && table) {
            suggestions.push({
              confidence: mapping.confidence || 0.5,
              webField,
              dbColumn: column,
              tableName: table.name,
              selector: webField.selector,
              transformType: mapping.transformType as TransformType || undefined,
              transformConfig: mapping.transformConfig,
            });
          }
        }
      }
    } catch (error) {
      console.error('AI mapping failed:', error);
      // Fall back to rule-based matching
      return this.ruleBasedMapping(webFields, tables);
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return suggestions;
  }

  /**
   * Generate CSS selectors for a target field based on HTML sample
   */
  async generateSelectors(
    targetField: string,
    htmlSample: string,
    existingSelectors?: string[]
  ): Promise<string[]> {
    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a web scraping expert. Given an HTML sample and a target field description, generate CSS selectors that would extract that field.

Return a JSON array of 3-5 CSS selectors, ordered by specificity (most specific first).

Example response:
{
  "selectors": [
    ".product-title h2",
    "[data-testid='title']",
    ".card-body h2"
  ]
}`,
          },
          {
            role: 'user',
            content: `Target field: ${targetField}\n\nHTML sample:\n${htmlSample.substring(0, 2000)}\n\n${existingSelectors ? `Existing selectors that don't work well: ${existingSelectors.join(', ')}` : ''}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const result = JSON.parse(content);
        return result.selectors || [];
      }
    } catch (error) {
      console.error('AI selector generation failed:', error);
    }

    return [];
  }

  /**
   * Infer the best data transformation for a web field to match a database column
   */
  async inferTransformation(
    sampleValues: string[],
    targetType: string
  ): Promise<{ transformType: TransformType | null; transformConfig: string | null }> {
    const samples = sampleValues.slice(0, 5).join(', ');

    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a data transformation expert. Given sample values and a target database type, determine what transformation is needed.

Available transformations:
- trim: Remove whitespace
- regex: Extract/replace with regex pattern
- date: Parse and format dates
- number: Extract numeric values
- json: Parse as JSON
- null: No transformation needed

Return a JSON object:
{
  "transformType": "regex",
  "transformConfig": {"pattern": "\\$([0-9.]+)", "group": 1},
  "reasoning": "Extract numeric price from currency string"
}`,
          },
          {
            role: 'user',
            content: `Sample values: ${samples}\nTarget database type: ${targetType}`,
          },
        ],
        max_tokens: 300,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const result = JSON.parse(content);
        return {
          transformType: result.transformType === 'null' ? null : result.transformType,
          transformConfig: result.transformConfig ? JSON.stringify(result.transformConfig) : null,
        };
      }
    } catch (error) {
      console.error('AI transformation inference failed:', error);
    }

    return { transformType: null, transformConfig: null };
  }

  /**
   * Rule-based fallback for mapping when AI is unavailable
   */
  private ruleBasedMapping(
    webFields: DetectedField[],
    tables: TableSchema[]
  ): MappingSuggestion[] {
    const suggestions: MappingSuggestion[] = [];

    // Common field name mappings
    const fieldMappings: Record<string, string[]> = {
      title: ['title', 'name', 'heading', 'subject'],
      name: ['name', 'title', 'label', 'full_name', 'fullname'],
      price: ['price', 'cost', 'amount', 'value'],
      description: ['description', 'desc', 'content', 'body', 'text'],
      image: ['image', 'img', 'photo', 'picture', 'thumbnail', 'image_url'],
      link_url: ['url', 'link', 'href', 'source_url'],
      date: ['date', 'created_at', 'updated_at', 'published_at', 'timestamp'],
    };

    for (const webField of webFields) {
      const possibleColumnNames = fieldMappings[webField.name] || [webField.name];

      for (const table of tables) {
        for (const column of table.columns) {
          const columnNameLower = column.name.toLowerCase();
          
          for (const possibleName of possibleColumnNames) {
            if (columnNameLower.includes(possibleName.toLowerCase()) ||
                possibleName.toLowerCase().includes(columnNameLower)) {
              suggestions.push({
                confidence: 0.6,
                webField,
                dbColumn: column,
                tableName: table.name,
                selector: webField.selector,
                transformType: this.inferBasicTransform(webField.dataType, column.type),
              });
              break;
            }
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Infer basic transformation based on data types
   */
  private inferBasicTransform(webType: DataType, dbType: string): TransformType | undefined {
    const dbTypeLower = dbType.toLowerCase();

    if (webType === 'string') {
      if (dbTypeLower.includes('int') || dbTypeLower.includes('decimal') || 
          dbTypeLower.includes('float') || dbTypeLower.includes('numeric')) {
        return 'number';
      }
      if (dbTypeLower.includes('date') || dbTypeLower.includes('time')) {
        return 'date';
      }
    }

    if (webType === 'number' && dbTypeLower.includes('char')) {
      return undefined; // String conversion happens automatically
    }

    return 'trim';
  }
}

/**
 * Create a default AI mapper instance
 */
export function createAIMapper(): AIMapper {
  return new AIMapper();
}

/**
 * Quick mapping suggestion function
 */
export async function suggestFieldMappings(
  tables: TableInfo[],
  webStructure: WebsiteStructure,
  targetTable?: string
): Promise<MappingSuggestion[]> {
  const mapper = new AIMapper();
  const dbSchema = await mapper.analyzeDatabase(tables);
  return mapper.suggestMappings(dbSchema, webStructure, targetTable);
}

/**
 * Analyze and describe database schema
 */
export async function analyzeDatabaseSchema(tables: TableInfo[]): Promise<{
  schema: DatabaseSchema;
  description: string;
}> {
  const mapper = new AIMapper();
  const schema = await mapper.analyzeDatabase(tables);
  const description = await mapper.describeDatabase(schema);
  return { schema, description };
}

/**
 * Generate extraction rules from mapping suggestions
 */
export function mappingsToExtractionRules(
  suggestions: MappingSuggestion[],
  assignmentId: string
): Partial<import('@/types').ExtractionRule>[] {
  return suggestions.map((suggestion, index) => ({
    assignmentId,
    targetColumn: suggestion.dbColumn.name,
    selector: suggestion.selector,
    selectorType: 'css' as const,
    attribute: suggestion.webField.attribute || 'text',
    transformType: suggestion.transformType || null,
    transformConfig: suggestion.transformConfig || null,
    dataType: suggestion.webField.dataType,
    isRequired: !suggestion.dbColumn.nullable,
    sortOrder: index,
    isActive: true,
  }));
}
