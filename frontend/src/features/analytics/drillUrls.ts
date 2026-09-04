import type { PaymentStatus } from '@/shared/constants/filterOptions';
import type { DashboardFilterState } from './types';

export function appendIds(params: URLSearchParams, key: string, ids: number[]) {
  ids.forEach((id) => params.append(key, String(id)));
}

export function buildEmployeesDrillUrl(filters: DashboardFilterState, extra?: {
  currencyIds?: number[];
  departmentIds?: number[];
  jobLevelIds?: number[];
}): string {
  const params = new URLSearchParams();
  params.set('apply', '1');
  appendIds(params, 'department_ids', extra?.departmentIds ?? filters.departmentIds);
  appendIds(params, 'job_level_ids', extra?.jobLevelIds ?? filters.jobLevelIds);
  filters.employmentStatuses.forEach((s) => params.append('employment_statuses', s));
  appendIds(params, 'currency_ids', extra?.currencyIds ?? filters.currencyIds);
  if (filters.salaryMin) params.set('salary_min', filters.salaryMin);
  if (filters.salaryMax) params.set('salary_max', filters.salaryMax);
  return `/employees?${params.toString()}`;
}

export function buildSalaryRecordsDrillUrl(filters: DashboardFilterState, extra?: {
  paymentStatuses?: PaymentStatus[];
  departmentIds?: number[];
  jobLevelIds?: number[];
}): string {
  const params = new URLSearchParams();
  params.set('apply', '1');
  if (filters.dateMode === 'range') {
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);
  } else if (filters.asOfDate) {
    params.set('date_from', filters.asOfDate);
    params.set('date_to', filters.asOfDate);
  }
  appendIds(params, 'department_ids', extra?.departmentIds ?? filters.departmentIds);
  appendIds(params, 'job_level_ids', extra?.jobLevelIds ?? filters.jobLevelIds);
  filters.currencyIds.forEach((id) => params.append('currency_ids', String(id)));
  filters.employmentStatuses.forEach((s) => params.append('employment_statuses', s));
  filters.recordStatuses.forEach((s) => params.append('record_statuses', s));
  const pays = extra?.paymentStatuses ?? filters.paymentStatuses;
  pays.forEach((s) => params.append('payment_statuses', s));
  if (filters.reportingCurrency) params.set('reporting_currency', filters.reportingCurrency);
  return `/salary-records?${params.toString()}`;
}
