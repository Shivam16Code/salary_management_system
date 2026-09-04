import type {
  EmploymentStatus,
  PaymentStatus,
  RecordStatus,
} from '@/shared/constants/filterOptions';

export const PIE_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626'];

export type DateMode = 'snapshot' | 'range';
export type AnalyticsTab = 'overview' | 'compensation' | 'payments' | 'trends';
export type BreakdownSortKey = 'employees' | 'avg' | 'total';

export interface DashboardFilterState {
  reportingCurrency: string;
  dateMode: DateMode;
  asOfDate: string;
  dateFrom: string;
  dateTo: string;
  departmentIds: number[];
  jobLevelIds: number[];
  paymentStatuses: PaymentStatus[];
  employmentStatuses: EmploymentStatus[];
  recordStatuses: RecordStatus[];
  currencyIds: number[];
  salaryMin: string;
  salaryMax: string;
}
