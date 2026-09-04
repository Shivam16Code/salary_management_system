import type { SalaryRecordFilters } from '@/shared/api';
import {
  EMPLOYMENT_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  RECORD_STATUS_OPTIONS,
  parseIntList,
  type EmploymentStatus,
  type PaymentStatus,
  type RecordStatus,
} from '@/shared/constants/filterOptions';

export interface SalaryRecordFilterState {
  search: string;
  dateFrom: string;
  dateTo: string;
  currencyIds: number[];
  departmentIds: number[];
  jobLevelIds: number[];
  paymentStatuses: PaymentStatus[];
  employmentStatuses: EmploymentStatus[];
  recordStatuses: RecordStatus[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

type SortableColumn = { label: string; sortKey?: string; align?: 'right' };

export const TABLE_COLUMNS: SortableColumn[] = [
  { label: 'Code', sortKey: 'employee_code' },
  { label: 'Name', sortKey: 'employee_name' },
  { label: 'Department', sortKey: 'department_name' },
  { label: 'Job Level', sortKey: 'job_level_name' },
  { label: 'Country', sortKey: 'country_name' },
  { label: 'Status', sortKey: 'employment_status' },
  { label: 'Period', sortKey: 'effective_from' },
  { label: 'Payment', sortKey: 'payment_status' },
  { label: 'Pay Amount', align: 'right' },
];

export function defaultFilters(): SalaryRecordFilterState {
  return {
    search: '',
    dateFrom: '',
    dateTo: '',
    currencyIds: [],
    departmentIds: [],
    jobLevelIds: [],
    paymentStatuses: [],
    employmentStatuses: [],
    recordStatuses: ['ACTIVE'],
    sortBy: 'effective_from',
    sortOrder: 'desc',
    page: 1,
    pageSize: 25,
  };
}

export function filtersFromSearchParams(params: URLSearchParams): { filters: SalaryRecordFilterState; reportingCurrency: string } | null {
  const hasScope = [...params.keys()].some((k) =>
    [
      'apply', 'date_from', 'date_to', 'department_ids', 'job_level_ids',
      'payment_statuses', 'employment_statuses', 'record_statuses', 'currency_ids',
    ].includes(k),
  );
  if (!hasScope) return null;

  const payment = params.getAll('payment_statuses').filter(
    (s): s is PaymentStatus => PAYMENT_STATUS_OPTIONS.some((o) => o.value === s),
  );
  const employment = params.getAll('employment_statuses').filter(
    (s): s is EmploymentStatus => EMPLOYMENT_STATUS_OPTIONS.some((o) => o.value === s),
  );
  const records = params.getAll('record_statuses').filter(
    (s): s is RecordStatus => RECORD_STATUS_OPTIONS.some((o) => o.value === s),
  );

  return {
    filters: {
      ...defaultFilters(),
      dateFrom: params.get('date_from') || '',
      dateTo: params.get('date_to') || '',
      currencyIds: parseIntList(params, 'currency_ids'),
      departmentIds: parseIntList(params, 'department_ids'),
      jobLevelIds: parseIntList(params, 'job_level_ids'),
      paymentStatuses: payment,
      employmentStatuses: employment,
      recordStatuses: records.length ? records : ['ACTIVE'],
    },
    reportingCurrency: params.get('reporting_currency') || 'USD',
  };
}

export function toApiFilters(state: SalaryRecordFilterState, reportingCurrency: string): SalaryRecordFilters {
  return {
    search: state.search || undefined,
    date_from: state.dateFrom || undefined,
    date_to: state.dateTo || undefined,
    currency_ids: state.currencyIds.length ? state.currencyIds : undefined,
    department_ids: state.departmentIds.length ? state.departmentIds : undefined,
    job_level_ids: state.jobLevelIds.length ? state.jobLevelIds : undefined,
    payment_statuses: state.paymentStatuses.length ? state.paymentStatuses : undefined,
    employment_statuses: state.employmentStatuses.length ? state.employmentStatuses : undefined,
    record_statuses: state.recordStatuses.length ? state.recordStatuses : undefined,
    sort_by: state.sortBy,
    sort_order: state.sortOrder,
    page: state.page,
    page_size: state.pageSize,
    reporting_currency: reportingCurrency,
  };
}

export function formatDateLabel(dateFrom: string, dateTo: string): string {
  if (dateFrom && dateTo) {
    return `${new Date(dateFrom).toLocaleDateString()} – ${new Date(dateTo).toLocaleDateString()}`;
  }
  if (dateFrom) return `From ${new Date(dateFrom).toLocaleDateString()}`;
  if (dateTo) return `Until ${new Date(dateTo).toLocaleDateString()}`;
  return 'All dates';
}

export function isDateRangeInvalid(dateFrom: string, dateTo: string): boolean {
  return Boolean(dateFrom && dateTo && dateFrom > dateTo);
}

export function filtersKey(state: SalaryRecordFilterState): string {
  return JSON.stringify(state);
}
