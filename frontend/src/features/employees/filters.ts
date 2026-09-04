import type { EmployeeCreatePayload, EmployeeFilters } from '@/shared/api';
import {
  EMPLOYMENT_STATUS_OPTIONS,
  parseIntList,
  type EmploymentStatus,
} from '@/shared/constants/filterOptions';

export { PAGE_SIZE_OPTIONS } from '@/shared/constants/filterOptions';

export const emptyForm: EmployeeCreatePayload = {
  first_name: '', last_name: '', email: '', country_id: 0,
  department_id: 0, job_level_id: 0, job_title: '', hire_date: new Date().toISOString().slice(0, 10),
};

export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'employee_code', label: 'Employee Code' },
  { value: 'last_name', label: 'Name (Last)' },
  { value: 'first_name', label: 'Name (First)' },
  { value: 'hire_date', label: 'Hire Date' },
  { value: 'job_title', label: 'Job Title' },
  { value: 'department_name', label: 'Department' },
  { value: 'job_level_name', label: 'Job Level' },
  { value: 'country_name', label: 'Country' },
  { value: 'employment_status', label: 'Status' },
];

export interface EmployeeFilterState {
  search: string;
  departmentIds: number[];
  jobLevelIds: number[];
  currencyIds: number[];
  employmentStatuses: EmploymentStatus[];
  salaryMin: string;
  salaryMax: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export type SortableColumn = { label: string; sortKey?: string; align?: 'right' };

export const TABLE_COLUMNS: SortableColumn[] = [
  { label: 'Code', sortKey: 'employee_code' },
  { label: 'Name', sortKey: 'last_name' },
  { label: 'Department', sortKey: 'department_name' },
  { label: 'Job Level', sortKey: 'job_level_name' },
  { label: 'Country', sortKey: 'country_name' },
  { label: 'Status', sortKey: 'employment_status' },
  { label: 'Annual Package', align: 'right' },
];

export function defaultFilters(): EmployeeFilterState {
  return {
    search: '',
    departmentIds: [],
    jobLevelIds: [],
    currencyIds: [],
    employmentStatuses: [],
    salaryMin: '',
    salaryMax: '',
    sortBy: 'employee_code',
    sortOrder: 'asc',
    page: 1,
    pageSize: 25,
  };
}

export function filtersFromSearchParams(params: URLSearchParams): EmployeeFilterState | null {
  if (params.get('apply') !== '1' && ![...params.keys()].some((k) =>
    ['department_ids', 'job_level_ids', 'employment_statuses', 'currency_ids'].includes(k)
  )) {
    return null;
  }
  const employment = params.getAll('employment_statuses').filter(
    (s): s is EmploymentStatus => EMPLOYMENT_STATUS_OPTIONS.some((o) => o.value === s),
  );
  return {
    ...defaultFilters(),
    departmentIds: parseIntList(params, 'department_ids'),
    jobLevelIds: parseIntList(params, 'job_level_ids'),
    currencyIds: parseIntList(params, 'currency_ids'),
    employmentStatuses: employment,
    salaryMin: params.get('salary_min') || '',
    salaryMax: params.get('salary_max') || '',
  };
}

export function toApiFilters(state: EmployeeFilterState): EmployeeFilters {
  return {
    search: state.search || undefined,
    department_ids: state.departmentIds.length ? state.departmentIds : undefined,
    job_level_ids: state.jobLevelIds.length ? state.jobLevelIds : undefined,
    employment_statuses: state.employmentStatuses.length ? state.employmentStatuses : undefined,
    currency_ids: state.currencyIds.length ? state.currencyIds : undefined,
    salary_min: state.salaryMin ? Number(state.salaryMin) : undefined,
    salary_max: state.salaryMax ? Number(state.salaryMax) : undefined,
    sort_by: state.sortBy,
    sort_order: state.sortOrder,
    page: state.page,
    page_size: state.pageSize,
  };
}

export function filtersKey(state: EmployeeFilterState): string {
  return JSON.stringify(state);
}
