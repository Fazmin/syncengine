import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import PQueue from 'p-queue';
import {
  ScraperConfig,
  ScraperType,
  AuthConfig,
  PaginationConfig,
  PaginationType,
  ExtractedData,
  WebsiteStructure,
  RepeatingElement,
  DetectedField,
  DataType,
  ExtractionRule,
} from '@/types';

// Default user agent
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Default timeout in milliseconds
const DEFAULT_TIMEOUT = 30000;

/**
 * Hybrid Web Scraper supporting both browser automation and HTTP requests
 */
export class WebScraper {
  private config: ScraperConfig;
  private browser: Browser | null = null;
  private queue: PQueue;

  constructor(config: ScraperConfig) {
    this.config = {
      ...config,
      userAgent: config.userAgent || DEFAULT_USER_AGENT,
      timeout: config.timeout || DEFAULT_TIMEOUT,
    };
    
    // Initialize request queue with concurrency limit
    this.queue = new PQueue({
      concurrency: config.maxConcurrent || 1,
      interval: config.requestDelay || 1000,
      intervalCap: 1,
    });
  }

  /**
   * Initialize browser instance for browser-based scraping
   */
  async initBrowser(): Promise<void> {
    if (this.browser) return;

    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080',
      ],
    });
  }

  /**
   * Close browser instance
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Scrape a URL and extract data based on extraction rules
   */
  async scrapeUrl(url: string, rules: ExtractionRule[]): Promise<ExtractedData> {
    return this.queue.add(async () => {
      const html = await this.fetchHtml(url);
      const rows = this.extractData(html, rules);

      return {
        url,
        timestamp: new Date(),
        rows,
      };
    }) as Promise<ExtractedData>;
  }

  /**
   * Fetch HTML content from URL
   */
  async fetchHtml(url: string): Promise<string> {
    const scraperType = this.determineScraperType(url);

    if (scraperType === 'browser') {
      return this.fetchWithBrowser(url);
    } else {
      return this.fetchWithHttp(url);
    }
  }

  /**
   * Determine the best scraper type based on configuration and URL
   */
  private determineScraperType(url: string): 'browser' | 'http' {
    if (this.config.type === 'browser') return 'browser';
    if (this.config.type === 'http') return 'http';

    // Hybrid mode: try HTTP first, fall back to browser if needed
    // For now, default to HTTP for efficiency
    return 'http';
  }

  /**
   * Fetch HTML using HTTP requests (Cheerio-compatible)
   */
  private async fetchWithHttp(url: string): Promise<string> {
    const headers: Record<string, string> = {
      'User-Agent': this.config.userAgent!,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    };

    // Add authentication headers if configured
    if (this.config.authType === 'header' && this.config.authConfig?.headers) {
      Object.assign(headers, this.config.authConfig.headers);
    }

    // Add basic auth if configured
    if (this.config.authType === 'basic' && this.config.authConfig) {
      const credentials = Buffer.from(
        `${this.config.authConfig.username}:${this.config.authConfig.password}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(this.config.timeout!),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * Fetch HTML using Puppeteer browser automation
   */
  private async fetchWithBrowser(url: string): Promise<string> {
    await this.initBrowser();

    const page = await this.browser!.newPage();

    try {
      // Set user agent
      await page.setUserAgent(this.config.userAgent!);

      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Set cookies if configured
      if (this.config.authType === 'cookie' && this.config.authConfig?.cookies) {
        const cookies = Object.entries(this.config.authConfig.cookies).map(([name, value]) => ({
          name,
          value,
          domain: new URL(url).hostname,
        }));
        await page.setCookie(...cookies);
      }

      // Navigate to URL
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout,
      });

      // Wait a bit for any dynamic content
      await page.waitForSelector('body', { timeout: 5000 });

      // Get the page content
      const html = await page.content();

      return html;
    } finally {
      await page.close();
    }
  }

  /**
   * Extract data from HTML using extraction rules
   */
  extractData(html: string, rules: ExtractionRule[]): Record<string, unknown>[] {
    const $ = cheerio.load(html);
    const rows: Record<string, unknown>[] = [];

    // Find the common parent element that contains repeating items
    // This is a simplified approach - in practice, you'd want smarter detection
    const activeRules = rules.filter(r => r.isActive);
    
    if (activeRules.length === 0) {
      return rows;
    }

    // Try to find repeating elements by looking at the first rule's selector
    const firstRule = activeRules[0];
    const elements = $(firstRule.selector);

    // If we find multiple elements, treat each as a row
    if (elements.length > 1) {
      elements.each((index, element) => {
        const row: Record<string, unknown> = {};
        
        for (const rule of activeRules) {
          const value = this.extractValue($, element, rule);
          row[rule.targetColumn] = value;
        }

        rows.push(row);
      });
    } else {
      // Single element - extract as one row
      const row: Record<string, unknown> = {};
      
      for (const rule of activeRules) {
        const value = this.extractValueFromRoot($, rule);
        row[rule.targetColumn] = value;
      }

      if (Object.keys(row).length > 0) {
        rows.push(row);
      }
    }

    return rows;
  }

  /**
   * Extract a single value from an element context
   */
  private extractValue(
    $: cheerio.CheerioAPI,
    context: cheerio.Element,
    rule: ExtractionRule
  ): unknown {
    try {
      let element: cheerio.Cheerio<cheerio.Element>;

      if (rule.selectorType === 'xpath') {
        // Cheerio doesn't support XPath natively, so we'd need a different approach
        // For now, treat it as CSS selector
        element = $(context).find(rule.selector);
      } else {
        element = $(context).find(rule.selector);
      }

      if (element.length === 0) {
        return rule.defaultValue ?? null;
      }

      let value: string;
      
      switch (rule.attribute) {
        case 'text':
          value = element.first().text().trim();
          break;
        case 'html':
          value = element.first().html() || '';
          break;
        default:
          value = element.first().attr(rule.attribute) || '';
      }

      return this.transformValue(value, rule);
    } catch {
      return rule.defaultValue ?? null;
    }
  }

  /**
   * Extract a single value from the root document
   */
  private extractValueFromRoot($: cheerio.CheerioAPI, rule: ExtractionRule): unknown {
    try {
      const element = $(rule.selector);

      if (element.length === 0) {
        return rule.defaultValue ?? null;
      }

      let value: string;
      
      switch (rule.attribute) {
        case 'text':
          value = element.first().text().trim();
          break;
        case 'html':
          value = element.first().html() || '';
          break;
        default:
          value = element.first().attr(rule.attribute) || '';
      }

      return this.transformValue(value, rule);
    } catch {
      return rule.defaultValue ?? null;
    }
  }

  /**
   * Transform extracted value based on rule configuration
   */
  private transformValue(value: string, rule: ExtractionRule): unknown {
    if (!value && rule.defaultValue) {
      return rule.defaultValue;
    }

    // Apply transformation if configured
    if (rule.transformType && rule.transformConfig) {
      try {
        const config = JSON.parse(rule.transformConfig);
        value = this.applyTransform(value, rule.transformType, config);
      } catch {
        // Ignore transform errors
      }
    }

    // Convert to target data type
    return this.convertToDataType(value, rule.dataType as DataType);
  }

  /**
   * Apply transformation to value
   */
  private applyTransform(
    value: string,
    transformType: string,
    config: Record<string, unknown>
  ): string {
    switch (transformType) {
      case 'trim':
        return value.trim();
      
      case 'regex':
        if (config.pattern) {
          const regex = new RegExp(config.pattern as string, config.flags as string || 'g');
          const match = value.match(regex);
          if (match) {
            return config.replacement !== undefined
              ? value.replace(regex, config.replacement as string)
              : match[config.group as number || 0] || value;
          }
        }
        return value;
      
      case 'date':
        // Parse date and format it
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
        return value;
      
      case 'number':
        // Extract numbers from string
        const numbers = value.replace(/[^0-9.-]/g, '');
        return numbers || value;
      
      default:
        return value;
    }
  }

  /**
   * Convert value to target data type
   */
  private convertToDataType(value: string, dataType: DataType): unknown {
    switch (dataType) {
      case 'number':
        const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
        return isNaN(num) ? null : num;
      
      case 'boolean':
        const lowered = value.toLowerCase();
        return ['true', 'yes', '1', 'on'].includes(lowered);
      
      case 'date':
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString();
      
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      
      case 'string':
      default:
        return value;
    }
  }

  /**
   * Detect pagination patterns on a URL
   */
  async detectPagination(url: string): Promise<PaginationConfig | null> {
    const html = await this.fetchHtml(url);
    const $ = cheerio.load(html);

    // Check for common pagination patterns
    const patterns: PaginationConfig[] = [];

    // 1. Check for query parameter pagination (e.g., ?page=1)
    const queryParamPattern = this.detectQueryParamPagination($, url);
    if (queryParamPattern) patterns.push(queryParamPattern);

    // 2. Check for next button pagination
    const nextButtonPattern = this.detectNextButtonPagination($);
    if (nextButtonPattern) patterns.push(nextButtonPattern);

    // 3. Check for path-based pagination (e.g., /page/1)
    const pathPattern = this.detectPathPagination($, url);
    if (pathPattern) patterns.push(pathPattern);

    // Return the most likely pattern
    return patterns.length > 0 ? patterns[0] : null;
  }

  /**
   * Detect query parameter pagination
   */
  private detectQueryParamPagination(
    $: cheerio.CheerioAPI,
    currentUrl: string
  ): PaginationConfig | null {
    const paginationSelectors = [
      'a[href*="page="]',
      'a[href*="p="]',
      'a[href*="offset="]',
      '.pagination a',
      '[class*="pagination"] a',
      'nav[aria-label*="pagination"] a',
    ];

    for (const selector of paginationSelectors) {
      const links = $(selector);
      if (links.length > 0) {
        const href = links.first().attr('href');
        if (href) {
          // Detect the pagination parameter
          const url = new URL(href, currentUrl);
          for (const [key] of url.searchParams) {
            if (['page', 'p', 'offset', 'start'].includes(key.toLowerCase())) {
              return {
                type: 'query_param',
                paramName: key,
                maxPages: 100,
                startPage: 1,
              };
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Detect next button pagination
   */
  private detectNextButtonPagination($: cheerio.CheerioAPI): PaginationConfig | null {
    const nextSelectors = [
      'a:contains("Next")',
      'a:contains("next")',
      'a:contains("→")',
      'a:contains("»")',
      'a[rel="next"]',
      'a.next',
      '.next a',
      '[class*="next"] a',
      'button:contains("Next")',
    ];

    for (const selector of nextSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const selectorUsed = selector;
        return {
          type: 'next_button',
          selector: selectorUsed,
          maxPages: 100,
        };
      }
    }

    return null;
  }

  /**
   * Detect path-based pagination
   */
  private detectPathPagination(
    $: cheerio.CheerioAPI,
    currentUrl: string
  ): PaginationConfig | null {
    const pathPatterns = [
      /\/page\/(\d+)/,
      /\/p\/(\d+)/,
      /\/(\d+)\/?$/,
    ];

    const links = $('a[href]');
    for (const pattern of pathPatterns) {
      let found = false;
      links.each((_, el) => {
        const href = $(el).attr('href');
        if (href && pattern.test(href)) {
          found = true;
          return false; // break
        }
      });

      if (found) {
        return {
          type: 'path',
          urlPattern: pattern.source,
          maxPages: 100,
          startPage: 1,
        };
      }
    }

    return null;
  }

  /**
   * Analyze website structure to detect data patterns
   */
  async analyzeStructure(url: string): Promise<WebsiteStructure> {
    const html = await this.fetchHtml(url);
    const $ = cheerio.load(html);

    const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';

    // Detect repeating elements
    const repeatingElements = this.detectRepeatingElements($);

    // Detect pagination
    const pagination = await this.detectPagination(url);

    // Detect forms
    const forms = this.detectForms($);

    // Detect important links
    const links = this.detectLinks($, url);

    return {
      url,
      title,
      repeatingElements,
      pagination: pagination || undefined,
      forms,
      links,
    };
  }

  /**
   * Detect repeating elements that likely contain data
   */
  private detectRepeatingElements($: cheerio.CheerioAPI): RepeatingElement[] {
    const candidates: RepeatingElement[] = [];

    // Common selectors for data containers
    const containerSelectors = [
      'table tbody tr',
      'ul li',
      'ol li',
      '.item',
      '.card',
      '.product',
      '.listing',
      '.result',
      '.row',
      '[class*="item"]',
      '[class*="card"]',
      '[class*="product"]',
      '[class*="listing"]',
      'article',
    ];

    for (const selector of containerSelectors) {
      const elements = $(selector);
      if (elements.length >= 3) { // At least 3 repeating items
        const first = elements.first();
        const sampleHtml = $.html(first).substring(0, 500);
        
        // Detect fields within the element
        const fields = this.detectFieldsInElement($, first);
        
        if (fields.length > 0) {
          candidates.push({
            selector,
            count: elements.length,
            sampleHtml,
            fields,
          });
        }
      }
    }

    // Sort by number of fields and count
    candidates.sort((a, b) => {
      const scoreA = a.fields.length * a.count;
      const scoreB = b.fields.length * b.count;
      return scoreB - scoreA;
    });

    return candidates.slice(0, 5); // Return top 5 candidates
  }

  /**
   * Detect fields within a repeating element
   */
  private detectFieldsInElement(
    $: cheerio.CheerioAPI,
    element: cheerio.Cheerio<cheerio.Element>
  ): DetectedField[] {
    const fields: DetectedField[] = [];

    // Look for common data patterns
    const patterns = [
      { selector: 'a', attribute: 'text', name: 'link_text' },
      { selector: 'a', attribute: 'href', name: 'link_url' },
      { selector: 'img', attribute: 'src', name: 'image' },
      { selector: 'img', attribute: 'alt', name: 'image_alt' },
      { selector: 'h1, h2, h3, h4, h5, h6', attribute: 'text', name: 'heading' },
      { selector: 'p', attribute: 'text', name: 'paragraph' },
      { selector: '.price, [class*="price"]', attribute: 'text', name: 'price' },
      { selector: '.title, [class*="title"]', attribute: 'text', name: 'title' },
      { selector: '.name, [class*="name"]', attribute: 'text', name: 'name' },
      { selector: '.description, [class*="desc"]', attribute: 'text', name: 'description' },
      { selector: '.date, [class*="date"], time', attribute: 'text', name: 'date' },
      { selector: 'span', attribute: 'text', name: 'text' },
    ];

    for (const pattern of patterns) {
      const found = element.find(pattern.selector);
      if (found.length > 0) {
        const value = pattern.attribute === 'text'
          ? found.first().text().trim()
          : found.first().attr(pattern.attribute) || '';

        if (value && value.length > 0 && value.length < 1000) {
          fields.push({
            name: pattern.name,
            selector: pattern.selector,
            attribute: pattern.attribute,
            sampleValue: value.substring(0, 100),
            dataType: this.inferDataType(value),
          });
        }
      }
    }

    return fields;
  }

  /**
   * Infer data type from a sample value
   */
  private inferDataType(value: string): DataType {
    // Check for number
    if (/^-?\d+\.?\d*$/.test(value.replace(/[,$]/g, ''))) {
      return 'number';
    }

    // Check for date
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}/,
      /^\d{2}\/\d{2}\/\d{4}/,
      /^\w+ \d{1,2}, \d{4}/,
    ];
    for (const pattern of datePatterns) {
      if (pattern.test(value)) {
        return 'date';
      }
    }

    // Check for boolean
    if (['true', 'false', 'yes', 'no'].includes(value.toLowerCase())) {
      return 'boolean';
    }

    // Check for JSON
    if ((value.startsWith('{') && value.endsWith('}')) ||
        (value.startsWith('[') && value.endsWith(']'))) {
      try {
        JSON.parse(value);
        return 'json';
      } catch {
        // Not valid JSON
      }
    }

    return 'string';
  }

  /**
   * Detect forms on the page
   */
  private detectForms($: cheerio.CheerioAPI): { selector: string; action: string; method: string; fields: string[] }[] {
    const forms: { selector: string; action: string; method: string; fields: string[] }[] = [];

    $('form').each((index, el) => {
      const form = $(el);
      const fields: string[] = [];

      form.find('input, select, textarea').each((_, field) => {
        const name = $(field).attr('name');
        if (name) fields.push(name);
      });

      forms.push({
        selector: `form:eq(${index})`,
        action: form.attr('action') || '',
        method: form.attr('method') || 'GET',
        fields,
      });
    });

    return forms;
  }

  /**
   * Detect important links on the page
   */
  private detectLinks(
    $: cheerio.CheerioAPI,
    baseUrl: string
  ): { text: string; href: string; type: 'pagination' | 'navigation' | 'external' | 'internal' }[] {
    const links: { text: string; href: string; type: 'pagination' | 'navigation' | 'external' | 'internal' }[] = [];
    const seen = new Set<string>();
    const baseHost = new URL(baseUrl).hostname;

    $('a[href]').each((_, el) => {
      const link = $(el);
      const href = link.attr('href');
      const text = link.text().trim();

      if (!href || seen.has(href) || href.startsWith('#') || href.startsWith('javascript:')) {
        return;
      }

      seen.add(href);

      try {
        const fullUrl = new URL(href, baseUrl);
        const isExternal = fullUrl.hostname !== baseHost;
        const isPagination = /page|p=|offset|start/i.test(href);

        links.push({
          text: text.substring(0, 100),
          href,
          type: isPagination ? 'pagination' : isExternal ? 'external' : 'internal',
        });
      } catch {
        // Invalid URL, skip
      }
    });

    return links.slice(0, 50); // Limit to 50 links
  }

  /**
   * Generate URLs for paginated scraping
   */
  generatePaginatedUrls(
    baseUrl: string,
    pagination: PaginationConfig,
    maxPages?: number
  ): string[] {
    const urls: string[] = [];
    const limit = maxPages || pagination.maxPages || 10;
    const start = pagination.startPage || 1;

    switch (pagination.type) {
      case 'query_param':
        for (let page = start; page <= limit; page++) {
          const url = new URL(baseUrl);
          url.searchParams.set(pagination.paramName || 'page', String(page));
          urls.push(url.toString());
        }
        break;

      case 'path':
        for (let page = start; page <= limit; page++) {
          const url = baseUrl.replace(/\/page\/\d+/, `/page/${page}`)
            .replace(/\/p\/\d+/, `/p/${page}`);
          urls.push(url);
        }
        break;

      default:
        urls.push(baseUrl);
    }

    return urls;
  }

  /**
   * Test connection to a URL
   */
  async testConnection(url: string): Promise<{ success: boolean; message: string; statusCode?: number }> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.config.userAgent!,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        return {
          success: true,
          message: 'Connection successful',
          statusCode: response.status,
        };
      } else {
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }
}

/**
 * Create a scraper instance from WebSource configuration
 */
export function createScraperFromWebSource(webSource: {
  baseUrl: string;
  scraperType: string;
  authType: string;
  authConfig?: string | null;
  requestDelay: number;
  maxConcurrent: number;
}): WebScraper {
  let authConfig: AuthConfig | undefined;

  if (webSource.authConfig) {
    try {
      authConfig = JSON.parse(webSource.authConfig);
    } catch {
      // Invalid auth config
    }
  }

  return new WebScraper({
    type: webSource.scraperType as ScraperType,
    baseUrl: webSource.baseUrl,
    requestDelay: webSource.requestDelay,
    maxConcurrent: webSource.maxConcurrent,
    authType: webSource.authType as 'none' | 'cookie' | 'header' | 'basic',
    authConfig,
  });
}

/**
 * Test scrape a URL with sample rules
 */
export async function testScrape(
  url: string,
  rules: ExtractionRule[],
  config?: Partial<ScraperConfig>
): Promise<ExtractedData> {
  const scraper = new WebScraper({
    type: 'http',
    baseUrl: url,
    requestDelay: 1000,
    maxConcurrent: 1,
    authType: 'none',
    ...config,
  });

  try {
    return await scraper.scrapeUrl(url, rules);
  } finally {
    await scraper.closeBrowser();
  }
}

/**
 * Analyze a website structure
 */
export async function analyzeWebsite(
  url: string,
  config?: Partial<ScraperConfig>
): Promise<WebsiteStructure> {
  const scraper = new WebScraper({
    type: 'http',
    baseUrl: url,
    requestDelay: 1000,
    maxConcurrent: 1,
    authType: 'none',
    ...config,
  });

  try {
    return await scraper.analyzeStructure(url);
  } finally {
    await scraper.closeBrowser();
  }
}

/**
 * Fetch raw HTML from a URL using the scraper
 */
export async function fetchPageHtml(
  url: string,
  config?: Partial<ScraperConfig>
): Promise<string> {
  const scraper = new WebScraper({
    type: 'http',
    baseUrl: url,
    requestDelay: 1000,
    maxConcurrent: 1,
    authType: 'none',
    ...config,
  });

  try {
    return await scraper.fetchHtml(url);
  } finally {
    await scraper.closeBrowser();
  }
}
