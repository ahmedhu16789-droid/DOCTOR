import { AppointmentStatus } from '../../types';
import { clinicDataStore } from '../localStore/appointmentsStore';
import type { DashboardAnalytics, DashboardRevenuePoint, DashboardVisitPoint } from '../dashboardRepository';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ACTIVE_VISIT_STATUSES = new Set([
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.WAITING,
  AppointmentStatus.CALLED,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
]);

const buildRevenueTemplate = (): DashboardRevenuePoint[] => ([
  { date: 'Mon', revenue: 0 },
  { date: 'Tue', revenue: 0 },
  { date: 'Wed', revenue: 0 },
  { date: 'Thu', revenue: 0 },
  { date: 'Fri', revenue: 0 },
  { date: 'Sat', revenue: 0 },
  { date: 'Sun', revenue: 0 },
]);

const getRevenueAmount = (total?: number, paid?: number): number => {
  if (typeof paid === 'number' && paid > 0) return paid;
  if (typeof total === 'number' && total > 0) return total;
  return 0;
};

export const generateDashboardAnalyticsMock = (branchId?: string): DashboardAnalytics => {
  const revenueByWeekday = new Map<string, number>(buildRevenueTemplate().map((point) => [point.date, point.revenue]));
  const visitsByDepartment = new Map<string, number>();

  clinicDataStore
    .getAppointments()
    .filter((appointment) => !branchId || appointment.branchId === branchId)
    .forEach((appointment) => {
      const appointmentDate = new Date(appointment.date);
      if (!Number.isNaN(appointmentDate.getTime())) {
        const weekdayLabel = WEEKDAY_LABELS[appointmentDate.getDay()];
        const amount = getRevenueAmount(appointment.billing?.total, appointment.billing?.paidAmount);
        revenueByWeekday.set(weekdayLabel, (revenueByWeekday.get(weekdayLabel) ?? 0) + amount);
      }

      if (ACTIVE_VISIT_STATUSES.has(appointment.status)) {
        const department = appointment.department || 'General';
        visitsByDepartment.set(department, (visitsByDepartment.get(department) ?? 0) + 1);
      }
    });

  const revenue = buildRevenueTemplate().map((point) => ({
    ...point,
    revenue: Math.round(revenueByWeekday.get(point.date) ?? 0),
  }));

  const visits_by_dept: DashboardVisitPoint[] = Array.from(visitsByDepartment.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count);

  return {
    revenue,
    visits_by_dept,
  };
};
