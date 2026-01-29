import { create } from 'zustand';
import type { DataSource, SyncConfig, SyncJob, DashboardStats } from '@/types';

interface AppState {
  // Data
  dataSources: DataSource[];
  syncConfigs: SyncConfig[];
  syncJobs: SyncJob[];
  dashboardStats: DashboardStats | null;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  sidebarOpen: boolean;
  
  // Actions
  setDataSources: (sources: DataSource[]) => void;
  addDataSource: (source: DataSource) => void;
  updateDataSource: (id: string, updates: Partial<DataSource>) => void;
  removeDataSource: (id: string) => void;
  
  setSyncConfigs: (configs: SyncConfig[]) => void;
  addSyncConfig: (config: SyncConfig) => void;
  updateSyncConfig: (id: string, updates: Partial<SyncConfig>) => void;
  removeSyncConfig: (id: string) => void;
  
  setSyncJobs: (jobs: SyncJob[]) => void;
  addSyncJob: (job: SyncJob) => void;
  updateSyncJob: (id: string, updates: Partial<SyncJob>) => void;
  
  setDashboardStats: (stats: DashboardStats) => void;
  
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  dataSources: [],
  syncConfigs: [],
  syncJobs: [],
  dashboardStats: null,
  isLoading: false,
  error: null,
  sidebarOpen: true,
  
  // Actions
  setDataSources: (sources) => set({ dataSources: sources }),
  addDataSource: (source) => set((state) => ({ 
    dataSources: [...state.dataSources, source] 
  })),
  updateDataSource: (id, updates) => set((state) => ({
    dataSources: state.dataSources.map((s) => 
      s.id === id ? { ...s, ...updates } : s
    )
  })),
  removeDataSource: (id) => set((state) => ({
    dataSources: state.dataSources.filter((s) => s.id !== id)
  })),
  
  setSyncConfigs: (configs) => set({ syncConfigs: configs }),
  addSyncConfig: (config) => set((state) => ({
    syncConfigs: [...state.syncConfigs, config]
  })),
  updateSyncConfig: (id, updates) => set((state) => ({
    syncConfigs: state.syncConfigs.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    )
  })),
  removeSyncConfig: (id) => set((state) => ({
    syncConfigs: state.syncConfigs.filter((c) => c.id !== id)
  })),
  
  setSyncJobs: (jobs) => set({ syncJobs: jobs }),
  addSyncJob: (job) => set((state) => ({
    syncJobs: [job, ...state.syncJobs]
  })),
  updateSyncJob: (id, updates) => set((state) => ({
    syncJobs: state.syncJobs.map((j) =>
      j.id === id ? { ...j, ...updates } : j
    )
  })),
  
  setDashboardStats: (stats) => set({ dashboardStats: stats }),
  
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));

