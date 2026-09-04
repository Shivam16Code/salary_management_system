import { buildQuery, fetchApi } from './http';

export interface AnalyticsSummary {
  employee_count: number;
  average_compensation: number;
  median_compensation: number;
  min_compensation: number;
  max_compensation: number;
  total_compensation: number;
  reporting_currency: string;
  as_of_date?: string | null;
}

export interface AnalyticsTrendPoint {
  period_label: string;
  period_date: string;
  employee_count: number;
  average_compensation: number;
  total_compensation: number;
}

export interface AnalyticsTrend {
  reporting_currency: string;
  date_from: string;
  date_to: string;
  points: AnalyticsTrendPoint[];
}

export interface AnalyticsFilters {
  as_of_date?: string;
  date_from?: string;
  date_to?: string;
  department_ids?: number[];
  job_level_ids?: number[];
  payment_statuses?: string[];
  employment_statuses?: string[];
  record_statuses?: string[];
  currency_ids?: number[];
  salary_min?: number;
  salary_max?: number;
}

export interface AnalyticsPaymentSummary {
  total_records: number;
  employee_count: number;
  paid_count: number;
  not_paid_count: number;
  total_paid_amount: number;
  total_not_paid_amount: number;
  reporting_currency: string;
}

export interface AnalyticsBreakdown {
  group_key: string;
  group_label: string;
  employee_count: number;
  average_compensation: number;
  total_compensation: number;
}

export interface DistributionBucket {
  range_label: string;
  min_value: number;
  max_value: number | null;
  employee_count: number;
  percentage: number;
}

export interface AnalyticsDistribution {
  reporting_currency: string;
  total_employees: number;
  buckets: DistributionBucket[];
}

export interface Analytics {
  summary: AnalyticsSummary;
  by_country: AnalyticsBreakdown[];
  by_department: AnalyticsBreakdown[];
  by_job_level: AnalyticsBreakdown[];
}

export interface AnalyticsFiltered {
  reporting_currency: string;
  mode: 'snapshot' | 'range';
  filters: AnalyticsFilters;
  summary: AnalyticsSummary;
  payment_summary: AnalyticsPaymentSummary;
  range_start_summary: AnalyticsSummary | null;
  range_end_summary: AnalyticsSummary | null;
  by_country: AnalyticsBreakdown[];
  by_department: AnalyticsBreakdown[];
  by_job_level: AnalyticsBreakdown[];
  distribution: AnalyticsDistribution;
  trend: AnalyticsTrend | null;
}

export const analyticsApi = {
  getAnalyticsSummary: (reportingCurrency: string, filters?: AnalyticsFilters) =>
    fetchApi<AnalyticsSummary>(`/analytics/summary${buildQuery({ reporting_currency: reportingCurrency, ...filters })}`),

  getAnalyticsByCountry: (reportingCurrency: string, filters?: AnalyticsFilters) =>
    fetchApi<AnalyticsBreakdown[]>(`/analytics/by-country${buildQuery({ reporting_currency: reportingCurrency, ...filters })}`),

  getAnalyticsByDepartment: (reportingCurrency: string, filters?: AnalyticsFilters) =>
    fetchApi<AnalyticsBreakdown[]>(`/analytics/by-department${buildQuery({ reporting_currency: reportingCurrency, ...filters })}`),

  getAnalyticsByLevel: (reportingCurrency: string, filters?: AnalyticsFilters) =>
    fetchApi<AnalyticsBreakdown[]>(`/analytics/by-level${buildQuery({ reporting_currency: reportingCurrency, ...filters })}`),

  getAnalyticsDistribution: (reportingCurrency: string, filters?: AnalyticsFilters) =>
    fetchApi<AnalyticsDistribution>(`/analytics/distribution${buildQuery({ reporting_currency: reportingCurrency, ...filters })}`),

  getAnalyticsTrend: (
    reportingCurrency: string,
    dateFrom: string,
    dateTo: string,
    filters?: Omit<AnalyticsFilters, 'date_from' | 'date_to' | 'as_of_date'>,
  ) =>
    fetchApi<AnalyticsTrend>(`/analytics/trend${buildQuery({ reporting_currency: reportingCurrency, date_from: dateFrom, date_to: dateTo, ...filters })}`),

  getFilteredAnalytics: (reportingCurrency: string, filters?: AnalyticsFilters) =>
    fetchApi<AnalyticsFiltered>(`/analytics/filtered${buildQuery({ reporting_currency: reportingCurrency, ...filters })}`),

  getAnalytics: async (reportingCurrency: string, filters?: AnalyticsFilters): Promise<Analytics> => {
    const query = buildQuery({ reporting_currency: reportingCurrency, ...filters });
    const [summary, by_country, by_department, by_job_level] = await Promise.all([
      fetchApi<AnalyticsSummary>(`/analytics/summary${query}`),
      fetchApi<AnalyticsBreakdown[]>(`/analytics/by-country${query}`),
      fetchApi<AnalyticsBreakdown[]>(`/analytics/by-department${query}`),
      fetchApi<AnalyticsBreakdown[]>(`/analytics/by-level${query}`),
    ]);
    return { summary, by_country, by_department, by_job_level };
  },
};
