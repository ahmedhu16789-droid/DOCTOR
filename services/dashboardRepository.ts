import { apiFetch } from './core/httpClient';

export interface DashboardRevenuePoint {
    date: string;   // "Mon", "Tue" …
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

export const getDashboardAnalytics = async (
    branchId?: string,
    signal?: AbortSignal,
): Promise<DashboardAnalytics> => {
    const query = new URLSearchParams();
    if (branchId) query.set('branchId', branchId);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<DashboardAnalytics>(`/reports/dashboard${qs}`, { signal });
};
