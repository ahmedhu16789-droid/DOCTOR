import { apiFetch } from './core/httpClient';
import { generateDashboardAnalyticsMock } from './mock/dashboardAnalyticsGenerator';

export interface DashboardRevenuePoint {
  date: string;
  revenue: number;
}

export interface DashboardVisitPoint {
  name: string;
  count: number;
}

export interface DashboardAnalytics {
  revenue: DashboardRevenuePoint[];
  visits_by_dept: DashboardVisitPoint[];
}

export interface DashboardRepository {
  getDashboardAnalytics(branchId?: string, signal?: AbortSignal): Promise<DashboardAnalytics>;
}

const MODE = String(import.meta.env.VITE_DATA_SOURCE_MODE ?? 'api').toLowerCase();

const apiDashboardRepository: DashboardRepository = {
  getDashboardAnalytics: async (branchId, signal) => {
    const query = new URLSearchParams();
    if (branchId) query.set('branchId', branchId);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<DashboardAnalytics>(`/reports/dashboard${qs}`, { signal });
  },
};

const mockDashboardRepository: DashboardRepository = {
  getDashboardAnalytics: async (branchId) => generateDashboardAnalyticsMock(branchId),
};

const hybridDashboardRepository: DashboardRepository = {
  getDashboardAnalytics: async (branchId, signal) => {
    try {
      return await apiDashboardRepository.getDashboardAnalytics(branchId, signal);
    } catch {
      return mockDashboardRepository.getDashboardAnalytics(branchId);
    }
  },
};

export const createDashboardRepository = (): DashboardRepository => {
  if (MODE === 'mock') return mockDashboardRepository;
  if (MODE === 'hybrid') return hybridDashboardRepository;
  return hybridDashboardRepository;
};

export const dashboardRepository = createDashboardRepository();

export const getDashboardAnalytics = async (
  branchId?: string,
  signal?: AbortSignal,
): Promise<DashboardAnalytics> => {
  return dashboardRepository.getDashboardAnalytics(branchId, signal);
};
