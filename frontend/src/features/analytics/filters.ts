import type { AnalyticsFilters } from '@/shared/api';
import type { DashboardFilterState, DateMode } from './types';

/** Local calendar date as YYYY-MM-DD (avoids UTC shift from toISOString). */
function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a local calendar date for display. */
function parseLocalIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function todayIso(): string {
  return toLocalIsoDate(new Date());
}

export function monthStartIso(d = new Date()): string {
  return toLocalIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return toLocalIsoDate(d);
}

export function yearStartIso(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export function defaultFilters(): DashboardFilterState {
  return {
    reportingCurrency: 'USD',
    dateMode: 'range',
    asOfDate: '',
    dateFrom: '',
    dateTo: '',
    departmentIds: [],
    jobLevelIds: [],
    paymentStatuses: [],
    employmentStatuses: [],
    recordStatuses: ['ACTIVE'],
    currencyIds: [],
    salaryMin: '',
    salaryMax: '',
  };
}

export function isDateRangeInvalid(dateFrom: string, dateTo: string): boolean {
  return Boolean(dateFrom && dateTo && dateFrom > dateTo);
}

export function formatDateLabel(dateMode: DateMode, asOfDate: string, dateFrom: string, dateTo: string): string {
  if (dateMode === 'snapshot') {
    return asOfDate ? parseLocalIsoDate(asOfDate).toLocaleDateString() : 'Today (snapshot)';
  }
  if (dateFrom && dateTo) {
    return `${parseLocalIsoDate(dateFrom).toLocaleDateString()} – ${parseLocalIsoDate(dateTo).toLocaleDateString()}`;
  }
  if (dateFrom) return `From ${parseLocalIsoDate(dateFrom).toLocaleDateString()}`;
  if (dateTo) return `Until ${parseLocalIsoDate(dateTo).toLocaleDateString()}`;
  return 'All dates';
}

export function toAnalyticsFilters(filters: DashboardFilterState): AnalyticsFilters {
  const base: AnalyticsFilters = {
    department_ids: filters.departmentIds.length ? filters.departmentIds : undefined,
    job_level_ids: filters.jobLevelIds.length ? filters.jobLevelIds : undefined,
    payment_statuses: filters.paymentStatuses.length ? filters.paymentStatuses : undefined,
    employment_statuses: filters.employmentStatuses.length ? filters.employmentStatuses : undefined,
    record_statuses: filters.recordStatuses.length ? filters.recordStatuses : undefined,
    currency_ids: filters.currencyIds.length ? filters.currencyIds : undefined,
    salary_min: filters.salaryMin ? Number(filters.salaryMin) : undefined,
    salary_max: filters.salaryMax ? Number(filters.salaryMax) : undefined,
  };
  if (filters.dateMode === 'snapshot') {
    return { ...base, as_of_date: filters.asOfDate || undefined };
  }
  return {
    ...base,
    date_from: filters.dateFrom || undefined,
    date_to: filters.dateTo || undefined,
  };
}

export function filtersKey(state: DashboardFilterState): string {
  return JSON.stringify(state);
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return (part / whole) * 100;
}
