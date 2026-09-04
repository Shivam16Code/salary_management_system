import { buildQuery, fetchApi, type QueryValue } from './http';
import type { PaginatedResponse } from './types';
import type {
  EmployeeSalaryProfile,
  EmployeeSalaryProfileCreatePayload,
  EmployeeSalaryProfileUpdatePayload,
  SalaryProfilePreview,
  SalaryRecord,
} from './salaries';

export interface Employee {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  country_code: string;
  country_name: string;
  country_currency_code: string;
  country_currency_symbol: string;
  department_code: string;
  department_name: string;
  job_level_code: string;
  job_level_name: string;
  job_title: string;
  employment_status: string;
  hire_date: string;
  current_salary: number | null;
  annual_package: number | null;
  currency_code: string | null;
  currency_symbol: string | null;
}

export interface EmployeeDetail extends Employee {
  salary_records: SalaryRecord[];
  salary_profile: EmployeeSalaryProfile | null;
}

export interface EmployeeFilters {
  search?: string;
  department_ids?: number[];
  job_level_ids?: number[];
  employment_statuses?: string[];
  currency_ids?: number[];
  salary_min?: number;
  salary_max?: number;
  sort_by?: string;
  sort_order?: string;
  page?: number;
  page_size?: number;
}

export interface EmployeeCreatePayload {
  employee_code?: string;
  first_name: string;
  last_name: string;
  email: string;
  country_id: number;
  department_id: number;
  job_level_id: number;
  job_title: string;
  employment_status?: string;
  hire_date: string;
}

export interface EmployeeUpdatePayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  country_id?: number;
  department_id?: number;
  job_level_id?: number;
  job_title?: string;
  employment_status?: string;
  hire_date?: string;
}

export const employeesApi = {
  getEmployees: (filters: EmployeeFilters) =>
    fetchApi<PaginatedResponse<Employee>>(`/employees${buildQuery(filters as Record<string, QueryValue>)}`),

  getEmployee: (id: number) => fetchApi<EmployeeDetail>(`/employees/${id}`),

  createEmployee: (data: EmployeeCreatePayload) =>
    fetchApi<EmployeeDetail>('/employees', { method: 'POST', body: JSON.stringify(data) }),

  updateEmployee: (id: number, data: EmployeeUpdatePayload) =>
    fetchApi<EmployeeDetail>(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteEmployee: (id: number) =>
    fetchApi<{ deleted: boolean; employee_id: number; employee_code: string; cascaded: Record<string, number> }>(
      `/employees/${id}`,
      { method: 'DELETE' },
    ),

  getEmployeeSalaries: (employeeId: number) =>
    fetchApi<SalaryRecord[]>(`/employees/${employeeId}/salaries`),

  getCurrentSalary: (employeeId: number) =>
    fetchApi<SalaryRecord>(`/employees/${employeeId}/salaries/current`),

  getSalaryProfile: (employeeId: number) =>
    fetchApi<EmployeeSalaryProfile>(`/employees/${employeeId}/salary-profile`),

  getSalaryProfileHistory: (employeeId: number) =>
    fetchApi<EmployeeSalaryProfile[]>(`/employees/${employeeId}/salary-profile/history`),

  createSalaryProfile: (employeeId: number, data: EmployeeSalaryProfileCreatePayload) =>
    fetchApi<EmployeeSalaryProfile>(`/employees/${employeeId}/salary-profile`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSalaryProfile: (employeeId: number, data: EmployeeSalaryProfileUpdatePayload) =>
    fetchApi<EmployeeSalaryProfile>(`/employees/${employeeId}/salary-profile`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  previewSalaryProfile: (data: EmployeeSalaryProfileCreatePayload) =>
    fetchApi<SalaryProfilePreview>('/employees/salary-profile/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
