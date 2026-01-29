// API client for SyncEngine

import type { 
  DataSource, 
  SyncConfig, 
  SyncJob, 
  DashboardStats,
  ApiResponse,
  DataSourceFormData,
  SyncConfigFormData,
  AuditLog,
  TableConfig,
  WebSource,
  WebSourceFormData,
  Assignment,
  AssignmentFormData,
  ExtractionJob,
  ExtractionRule,
  ExtractionRuleFormData,
  WebsiteStructure,
  MappingSuggestion,
  ProcessLog,
} from '@/types';

const BASE_URL = '/api';

async function fetchApi<T>(
  endpoint: string, 
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Request failed' };
    }
    
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Dashboard
export async function getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
  return fetchApi<DashboardStats>('/dashboard/stats');
}

// Data Sources
export async function getDataSources(): Promise<ApiResponse<DataSource[]>> {
  return fetchApi<DataSource[]>('/data-sources');
}

export async function getDataSource(id: string): Promise<ApiResponse<DataSource>> {
  return fetchApi<DataSource>(`/data-sources/${id}`);
}

export async function createDataSource(data: DataSourceFormData): Promise<ApiResponse<DataSource>> {
  return fetchApi<DataSource>('/data-sources', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDataSource(id: string, data: Partial<DataSourceFormData>): Promise<ApiResponse<DataSource>> {
  return fetchApi<DataSource>(`/data-sources/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteDataSource(id: string): Promise<ApiResponse<void>> {
  return fetchApi<void>(`/data-sources/${id}`, {
    method: 'DELETE',
  });
}

export async function testDataSourceConnection(id: string): Promise<ApiResponse<{ status: string; message: string }>> {
  return fetchApi<{ status: string; message: string }>(`/data-sources/${id}/test`);
}

export async function getDataSourceTables(id: string): Promise<ApiResponse<{ schema: string; table: string; columns: { name: string; type: string }[] }[]>> {
  return fetchApi(`/data-sources/${id}/tables`);
}

// Sync Configs
export async function getSyncConfigs(): Promise<ApiResponse<SyncConfig[]>> {
  return fetchApi<SyncConfig[]>('/sync-configs');
}

export async function getSyncConfig(id: string): Promise<ApiResponse<SyncConfig>> {
  return fetchApi<SyncConfig>(`/sync-configs/${id}`);
}

export async function createSyncConfig(data: SyncConfigFormData): Promise<ApiResponse<SyncConfig>> {
  return fetchApi<SyncConfig>('/sync-configs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSyncConfig(id: string, data: Partial<SyncConfigFormData>): Promise<ApiResponse<SyncConfig>> {
  return fetchApi<SyncConfig>(`/sync-configs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteSyncConfig(id: string): Promise<ApiResponse<void>> {
  return fetchApi<void>(`/sync-configs/${id}`, {
    method: 'DELETE',
  });
}

// Table Configs
export async function updateTableConfigs(syncConfigId: string, tables: Partial<TableConfig>[]): Promise<ApiResponse<TableConfig[]>> {
  return fetchApi<TableConfig[]>(`/sync-configs/${syncConfigId}/tables`, {
    method: 'PUT',
    body: JSON.stringify({ tables }),
  });
}

// Sync Jobs
export async function getSyncJobs(syncConfigId?: string): Promise<ApiResponse<SyncJob[]>> {
  const query = syncConfigId ? `?syncConfigId=${syncConfigId}` : '';
  return fetchApi<SyncJob[]>(`/sync-jobs${query}`);
}

export async function getSyncJob(id: string): Promise<ApiResponse<SyncJob>> {
  return fetchApi<SyncJob>(`/sync-jobs/${id}`);
}

export async function triggerSync(syncConfigId: string): Promise<ApiResponse<SyncJob>> {
  return fetchApi<SyncJob>(`/sync-configs/${syncConfigId}/run`, {
    method: 'POST',
  });
}

export async function cancelSyncJob(id: string): Promise<ApiResponse<SyncJob>> {
  return fetchApi<SyncJob>(`/sync-jobs/${id}/cancel`, {
    method: 'POST',
  });
}

// Audit Logs
export async function getAuditLogs(params?: {
  resourceType?: string;
  resourceId?: string;
  limit?: number;
}): Promise<ApiResponse<AuditLog[]>> {
  const queryParams = new URLSearchParams();
  if (params?.resourceType) queryParams.set('resourceType', params.resourceType);
  if (params?.resourceId) queryParams.set('resourceId', params.resourceId);
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  
  const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
  return fetchApi<AuditLog[]>(`/audit-logs${query}`);
}

// Downloads
export function getDownloadUrl(jobId: string): string {
  return `${BASE_URL}/downloads/${jobId}`;
}

// ============================================
// SyncEngine API - Web Sources
// ============================================

export async function getWebSources(): Promise<ApiResponse<WebSource[]>> {
  return fetchApi<WebSource[]>('/web-sources');
}

export async function getWebSource(id: string): Promise<ApiResponse<WebSource>> {
  return fetchApi<WebSource>(`/web-sources/${id}`);
}

export async function createWebSource(data: WebSourceFormData): Promise<ApiResponse<WebSource>> {
  return fetchApi<WebSource>('/web-sources', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateWebSource(id: string, data: Partial<WebSourceFormData>): Promise<ApiResponse<WebSource>> {
  return fetchApi<WebSource>(`/web-sources/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteWebSource(id: string): Promise<ApiResponse<void>> {
  return fetchApi<void>(`/web-sources/${id}`, {
    method: 'DELETE',
  });
}

export async function analyzeWebSource(id: string, url?: string): Promise<ApiResponse<{ success: boolean; structure: WebsiteStructure }>> {
  return fetchApi(`/web-sources/${id}/analyze`, {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function testWebSourceConnection(
  id: string, 
  options?: { url?: string; selectors?: { selector: string; attribute?: string; name?: string }[] }
): Promise<ApiResponse<{ success: boolean; message?: string; error?: string; extractedData?: unknown }>> {
  return fetchApi(`/web-sources/${id}/test-scrape`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
}

// ============================================
// SyncEngine API - Assignments
// ============================================

export async function getAssignments(filters?: { 
  status?: string; 
  dataSourceId?: string;
  webSourceId?: string;
}): Promise<ApiResponse<Assignment[]>> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.dataSourceId) params.set('dataSourceId', filters.dataSourceId);
  if (filters?.webSourceId) params.set('webSourceId', filters.webSourceId);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi<Assignment[]>(`/assignments${query}`);
}

export async function getAssignment(id: string): Promise<ApiResponse<Assignment>> {
  return fetchApi<Assignment>(`/assignments/${id}`);
}

export async function createAssignment(data: AssignmentFormData): Promise<ApiResponse<Assignment>> {
  return fetchApi<Assignment>('/assignments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAssignment(id: string, data: Partial<AssignmentFormData & { status?: string }>): Promise<ApiResponse<Assignment>> {
  return fetchApi<Assignment>(`/assignments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteAssignment(id: string): Promise<ApiResponse<void>> {
  return fetchApi<void>(`/assignments/${id}`, {
    method: 'DELETE',
  });
}

export async function suggestMappings(assignmentId: string, url?: string): Promise<ApiResponse<{
  success: boolean;
  suggestions: MappingSuggestion[];
  proposedRules: Partial<ExtractionRule>[];
  webStructure: WebsiteStructure;
  availableTables: { schema: string; table: string; columns: { name: string; type: string; nullable: boolean; isPrimaryKey: boolean }[] }[];
}>> {
  return fetchApi(`/assignments/${assignmentId}/suggest-mapping`, {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function runSampleTest(assignmentId: string, maxRows?: number): Promise<ApiResponse<{
  success: boolean;
  rows: Record<string, unknown>[];
  columns?: string[];
  sourceUrl?: string;
  error?: string;
}>> {
  return fetchApi(`/assignments/${assignmentId}/sample-test`, {
    method: 'POST',
    body: JSON.stringify({ maxRows }),
  });
}

export async function getExtractionRules(assignmentId: string): Promise<ApiResponse<ExtractionRule[]>> {
  return fetchApi<ExtractionRule[]>(`/assignments/${assignmentId}/mappings`);
}

export async function updateExtractionRules(assignmentId: string, rules: ExtractionRuleFormData[]): Promise<ApiResponse<{ success: boolean; rules: ExtractionRule[] }>> {
  return fetchApi(`/assignments/${assignmentId}/mappings`, {
    method: 'PUT',
    body: JSON.stringify({ rules }),
  });
}

export async function addExtractionRule(assignmentId: string, rule: ExtractionRuleFormData): Promise<ApiResponse<ExtractionRule>> {
  return fetchApi<ExtractionRule>(`/assignments/${assignmentId}/mappings`, {
    method: 'POST',
    body: JSON.stringify(rule),
  });
}

export async function triggerExtraction(assignmentId: string, mode?: 'manual' | 'auto'): Promise<ApiResponse<{ success: boolean; jobId: string; mode: string }>> {
  return fetchApi(`/assignments/${assignmentId}/run`, {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}

// ============================================
// SyncEngine API - Extraction Jobs
// ============================================

export async function getExtractionJobs(filters?: {
  assignmentId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ApiResponse<{ jobs: ExtractionJob[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }>> {
  const params = new URLSearchParams();
  if (filters?.assignmentId) params.set('assignmentId', filters.assignmentId);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.limit) params.set('limit', filters.limit.toString());
  if (filters?.offset) params.set('offset', filters.offset.toString());
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi(`/extraction-jobs${query}`);
}

export async function getExtractionJob(id: string): Promise<ApiResponse<ExtractionJob & { duration?: number; hasStagedData?: boolean }>> {
  return fetchApi(`/extraction-jobs/${id}`);
}

export async function commitExtractionJob(id: string): Promise<ApiResponse<{ success: boolean; message: string; rowsInserted: number; rowsFailed: number }>> {
  return fetchApi(`/extraction-jobs/${id}/commit`, {
    method: 'POST',
  });
}

export async function cancelExtractionJob(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
  return fetchApi(`/extraction-jobs/${id}/cancel`, {
    method: 'POST',
  });
}

export async function getStagedData(jobId: string, page?: number, pageSize?: number): Promise<ApiResponse<{
  rows: Record<string, unknown>[];
  columns: string[];
  pagination: { page: number; pageSize: number; totalRows: number; totalPages: number; hasMore: boolean };
}>> {
  const params = new URLSearchParams();
  if (page) params.set('page', page.toString());
  if (pageSize) params.set('pageSize', pageSize.toString());
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi(`/extraction-jobs/${jobId}/staged-data${query}`);
}

export async function getJobLogs(jobId: string, options?: { level?: string; limit?: number; offset?: number }): Promise<ApiResponse<{
  logs: ProcessLog[];
  counts: Record<string, number>;
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
}>> {
  const params = new URLSearchParams();
  if (options?.level) params.set('level', options.level);
  if (options?.limit) params.set('limit', options.limit.toString());
  if (options?.offset) params.set('offset', options.offset.toString());
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi(`/extraction-jobs/${jobId}/logs${query}`);
}

// ============================================
// SyncEngine API - Process Logs
// ============================================

export async function getProcessLogs(filters?: {
  jobId?: string;
  level?: string;
  limit?: number;
  offset?: number;
}): Promise<ApiResponse<{ logs: ProcessLog[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }>> {
  const params = new URLSearchParams();
  if (filters?.jobId) params.set('jobId', filters.jobId);
  if (filters?.level) params.set('level', filters.level);
  if (filters?.limit) params.set('limit', filters.limit.toString());
  if (filters?.offset) params.set('offset', filters.offset.toString());
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchApi(`/logs${query}`);
}

