// Type definitions for SyncEngine

export type DatabaseType = 'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'oracle';

export type ConnectionStatus = 'connected' | 'failed' | 'untested';

export type SyncMode = 'full' | 'incremental';

export type ScheduleType = 'manual' | 'hourly' | 'daily' | 'weekly' | 'cron';

export type MaskingType = 'none' | 'redact' | 'hash' | 'randomize' | 'partial';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type UserRole = 'admin' | 'supervisor';

export type UserStatus = 'pending' | 'approved' | 'suspended' | 'expired';

// SyncEngine specific types
export type ScraperType = 'browser' | 'http' | 'hybrid';

export type AuthType = 'none' | 'cookie' | 'header' | 'basic';

export type PaginationType = 'query_param' | 'path' | 'infinite_scroll' | 'next_button' | 'none';

export type AssignmentStatus = 'draft' | 'testing' | 'active' | 'paused' | 'error';

export type ExtractionSyncMode = 'manual' | 'auto';

export type ExtractionJobStatus = 'pending' | 'running' | 'staging' | 'completed' | 'failed' | 'cancelled';

export type SelectorType = 'css' | 'xpath';

export type AttributeType = 'text' | 'href' | 'src' | 'html' | string;

export type TransformType = 'trim' | 'regex' | 'date' | 'number' | 'json' | 'custom';

export type DataType = 'string' | 'number' | 'date' | 'boolean' | 'json';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface DataSource {
  id: string;
  name: string;
  description?: string | null;
  dbType: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslEnabled: boolean;
  isActive: boolean;
  lastTestedAt?: Date | null;
  connectionStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncConfig {
  id: string;
  name: string;
  description?: string | null;
  dataSourceId: string;
  dataSource?: DataSource;
  isActive: boolean;
  syncMode: string;
  scheduleType: string;
  cronExpression?: string | null;
  outputPath: string;
  outputFileName: string;
  compressOutput: boolean;
  encryptOutput: boolean;
  tableConfigs?: TableConfig[];
  syncJobs?: SyncJob[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TableConfig {
  id: string;
  syncConfigId: string;
  sourceSchema: string;
  sourceTable: string;
  targetTable?: string | null;
  whereClause?: string | null;
  rowLimit?: number | null;
  incrementalColumn?: string | null;
  lastSyncValue?: string | null;
  columnConfigs?: ColumnConfig[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ColumnConfig {
  id: string;
  tableConfigId: string;
  sourceColumn: string;
  targetColumn?: string | null;
  dataType?: string | null;
  maskingType: string;
  maskingConfig?: string | null;
  isIncluded: boolean;
  isPrimaryKey: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncJob {
  id: string;
  syncConfigId: string;
  syncConfig?: SyncConfig;
  status: string;
  startedAt?: Date | null;
  completedAt?: Date | null;
  rowsProcessed: number;
  tablesProcessed: number;
  outputFileSize?: number | null;
  outputFilePath?: string | null;
  errorMessage?: string | null;
  errorDetails?: string | null;
  triggeredBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  eventType: string;
  eventDetails?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  ipAddress?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  dataSourceId?: string | null;
  dataSource?: DataSource | null;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  status: string;
  isActive: boolean;
  expiresAt?: Date | null;
  approvedAt?: Date | null;
  approvedBy?: string | null;
  lastLoginAt?: Date | null;
  loginCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OtpToken {
  id: string;
  code: string;
  userId: string;
  expiresAt: Date;
  used: boolean;
  usedAt?: Date | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}

export interface SmtpSettings {
  id: string;
  enabled: boolean;
  service: string;
  host?: string | null;
  port: number;
  secure: boolean;
  ignoreTls: boolean;
  username?: string | null;
  password?: string | null;
  fromEmail?: string | null;
  fromName: string;
  lastTestedAt?: Date | null;
  testStatus?: string | null;
  testError?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardStats {
  totalDataSources: number;
  activeDataSources: number;
  totalSyncConfigs: number;
  activeSyncConfigs: number;
  totalSyncJobs: number;
  successfulJobs: number;
  failedJobs: number;
  runningJobs: number;
  recentJobs: SyncJob[];
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Form types
export interface DataSourceFormData {
  name: string;
  description?: string;
  dbType: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslEnabled: boolean;
}

export interface SyncConfigFormData {
  name: string;
  description?: string;
  dataSourceId: string;
  syncMode: SyncMode;
  scheduleType: ScheduleType;
  cronExpression?: string;
  outputPath: string;
  outputFileName: string;
  compressOutput: boolean;
  encryptOutput: boolean;
}

// SyncEngine specific interfaces

export interface WebSource {
  id: string;
  name: string;
  baseUrl: string;
  description?: string | null;
  scraperType: string;
  authType: string;
  authConfig?: string | null;
  requestDelay: number;
  maxConcurrent: number;
  paginationType?: string | null;
  paginationConfig?: string | null;
  isActive: boolean;
  lastTestedAt?: Date | null;
  connectionStatus: string;
  structureJson?: string | null;
  lastAnalyzedAt?: Date | null;
  assignments?: Assignment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Assignment {
  id: string;
  name: string;
  description?: string | null;
  dataSourceId: string;
  dataSource?: DataSource;
  webSourceId: string;
  webSource?: WebSource;
  targetTable: string;
  targetSchema: string;
  syncMode: string;
  scheduleType: string;
  cronExpression?: string | null;
  status: string;
  mappingConfig?: string | null;
  startUrl?: string | null;
  extractionRules?: ExtractionRule[];
  extractionJobs?: ExtractionJob[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ExtractionRule {
  id: string;
  assignmentId: string;
  assignment?: Assignment;
  targetColumn: string;
  selector: string;
  selectorType: string;
  attribute: string;
  transformType?: string | null;
  transformConfig?: string | null;
  defaultValue?: string | null;
  dataType: string;
  isRequired: boolean;
  validationRegex?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExtractionJob {
  id: string;
  assignmentId: string;
  assignment?: Assignment;
  status: string;
  syncMode: string;
  startedAt?: Date | null;
  completedAt?: Date | null;
  pagesProcessed: number;
  pagesTotal?: number | null;
  rowsExtracted: number;
  rowsInserted: number;
  rowsFailed: number;
  stagedDataPath?: string | null;
  stagedDataJson?: string | null;
  stagedRowCount: number;
  currentUrl?: string | null;
  errorMessage?: string | null;
  errorDetails?: string | null;
  triggeredBy: string;
  processLogs?: ProcessLog[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessLog {
  id: string;
  jobId: string;
  job?: ExtractionJob;
  level: string;
  message: string;
  details?: string | null;
  url?: string | null;
  rowIndex?: number | null;
  createdAt: Date;
}

// Web Scraper types
export interface ScraperConfig {
  type: ScraperType;
  baseUrl: string;
  requestDelay: number;
  maxConcurrent: number;
  authType: AuthType;
  authConfig?: AuthConfig;
  userAgent?: string;
  timeout?: number;
}

export interface AuthConfig {
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
  username?: string;
  password?: string;
}

export interface PaginationConfig {
  type: PaginationType;
  paramName?: string;
  selector?: string;
  urlPattern?: string;
  maxPages?: number;
  startPage?: number;
}

export interface ExtractedData {
  url: string;
  timestamp: Date;
  rows: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
}

export interface WebsiteStructure {
  url: string;
  title: string;
  repeatingElements: RepeatingElement[];
  pagination?: PaginationConfig;
  forms?: FormElement[];
  links?: LinkElement[];
}

export interface RepeatingElement {
  selector: string;
  count: number;
  sampleHtml: string;
  fields: DetectedField[];
}

export interface DetectedField {
  name: string;
  selector: string;
  attribute: string;
  sampleValue: string;
  dataType: DataType;
}

export interface FormElement {
  selector: string;
  action: string;
  method: string;
  fields: string[];
}

export interface LinkElement {
  text: string;
  href: string;
  type: 'pagination' | 'navigation' | 'external' | 'internal';
}

// AI Mapper types
export interface DatabaseSchema {
  tables: TableSchema[];
}

export interface TableSchema {
  name: string;
  schema: string;
  columns: ColumnSchema[];
  primaryKeys: string[];
  rowCount?: number;
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string;
}

export interface MappingSuggestion {
  confidence: number;
  webField: DetectedField;
  dbColumn: ColumnSchema;
  tableName: string;
  selector: string;
  transformType?: TransformType;
  transformConfig?: string;
}

// Form data types
export interface WebSourceFormData {
  name: string;
  baseUrl: string;
  description?: string;
  scraperType: ScraperType;
  authType: AuthType;
  authConfig?: string;
  requestDelay: number;
  maxConcurrent: number;
}

export interface AssignmentFormData {
  name: string;
  description?: string;
  dataSourceId: string;
  webSourceId: string;
  targetTable: string;
  targetSchema?: string;
  syncMode: ExtractionSyncMode;
  scheduleType: ScheduleType;
  cronExpression?: string;
  startUrl?: string;
}

export interface ExtractionRuleFormData {
  targetColumn: string;
  selector: string;
  selectorType: SelectorType;
  attribute: AttributeType;
  transformType?: TransformType;
  transformConfig?: string;
  defaultValue?: string;
  dataType: DataType;
  isRequired: boolean;
  validationRegex?: string;
}

