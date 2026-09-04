import { buildQuery, fetchApi, type QueryValue } from './http';
import type { PaginatedResponse } from './types';

export interface SalaryRecordComponent {
  id: number;
  salary_component_id?: number;
  component_code: string;
  component_name: string;
  component_type: string;
  calculation_method?: string;
  amount?: number;
  units?: number | null;
  calculated_amount: number;
}

export interface SalaryRecord {
  id: number;
  employee_id: number;
  currency_code: string;
  currency_symbol: string;
  effective_from: string;
  effective_to: string | null;
  status: string;
  payment_status: string;
  total_earnings: number;
  total_deductions: number;
  adjusted_compensation: number;
  components: SalaryRecordComponent[];
}

export interface EmployeeSalaryProfile {
  id: number;
  employee_id: number;
  package_amount: number;
  pay_frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  annual_package: number;
  base_salary: number;
  per_period_amount: number;
  currency_code: string;
  currency_symbol: string;
  effective_from: string;
  effective_to: string | null;
  status: string;
  change_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalaryProfilePreview {
  package_amount: number;
  pay_frequency: string;
  annual_package: number;
  base_salary: number;
  per_period_amount: number;
}

export interface EmployeeSalaryProfileCreatePayload {
  package_amount: number;
  pay_frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  effective_from: string;
  change_reason?: string;
}

export interface EmployeeSalaryProfileUpdatePayload {
  package_amount: number;
  pay_frequency?: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  effective_from: string;
  change_reason?: string;
}

export interface SalaryRecordComponentPayload {
  salary_component_id: number;
  amount: number;
  units?: number;
}

export interface SalaryRecordCreatePayload {
  effective_from: string;
  effective_to?: string;
  status?: string;
  payment_status?: string;
  components: SalaryRecordComponentPayload[];
}

export interface SalaryRecordUpdatePayload {
  effective_to?: string;
  status?: string;
  payment_status?: string;
  components?: SalaryRecordComponentPayload[];
}

export interface SalaryRecordListItem extends SalaryRecord {
  employee_code: string;
  employee_name: string;
  job_title: string;
  employment_status: string;
  department_code: string;
  department_name: string;
  job_level_code: string;
  job_level_name: string;
  country_code: string;
  country_name: string;
}

export interface SalaryRecordFilters {
  search?: string;
  date_from?: string;
  date_to?: string;
  currency_ids?: number[];
  department_ids?: number[];
  job_level_ids?: number[];
  payment_statuses?: string[];
  employment_statuses?: string[];
  record_statuses?: string[];
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
  reporting_currency?: string;
}

export interface SalaryRecordFilterSummary {
  total_records: number;
  employee_count: number;
  paid_count: number;
  not_paid_count: number;
  total_paid_amount: number;
  total_not_paid_amount: number;
  reporting_currency: string;
}

export interface SalaryRecordListResponse extends PaginatedResponse<SalaryRecordListItem> {
  summary: SalaryRecordFilterSummary;
}

export const salariesApi = {
  getSalaryRecords: (filters?: SalaryRecordFilters) =>
    fetchApi<SalaryRecordListResponse>(
      `/salaries${buildQuery((filters ?? {}) as Record<string, QueryValue>)}`,
    ),

  createSalary: (employeeId: number, data: SalaryRecordCreatePayload) =>
    fetchApi<SalaryRecord>(`/employees/${employeeId}/salaries`, { method: 'POST', body: JSON.stringify(data) }),

  updateSalary: (recordId: number, data: SalaryRecordUpdatePayload) =>
    fetchApi<SalaryRecord>(`/salaries/${recordId}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteSalary: (recordId: number) =>
    fetchApi<{ deleted: boolean; record_id: number; employee_id: number; cascaded: Record<string, number> }>(
      `/salaries/${recordId}`,
      { method: 'DELETE' },
    ),
};
