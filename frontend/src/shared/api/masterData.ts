import { buildQuery, fetchApi } from './http';

export interface Country {
  id: number;
  iso_code: string;
  name: string;
  currency_id: number;
  currency_code: string;
  is_active: boolean;
}

export interface Currency {
  id: number;
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  is_active: boolean;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
}

export interface JobLevel {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface CountryReferenceItem {
  iso_code: string;
  name: string;
  currency_code: string;
}

export interface CountryCreatePayload {
  iso_code: string;
  is_active?: boolean;
}

export interface CountryUpdatePayload {
  is_active?: boolean;
}

export interface DepartmentCreatePayload {
  code: string;
  name: string;
  is_active?: boolean;
}

export interface DepartmentUpdatePayload {
  name?: string;
  is_active?: boolean;
}

export interface JobLevelCreatePayload {
  code: string;
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface JobLevelUpdatePayload {
  name?: string;
  description?: string;
  is_active?: boolean;
}

export const masterDataApi = {
  getCountryReference: (search?: string, excludeExisting = true) =>
    fetchApi<CountryReferenceItem[]>(
      `/countries/reference${buildQuery({ search, exclude_existing: excludeExisting ? 'true' : 'false' })}`,
    ),

  getCountries: (activeOnly = false) =>
    fetchApi<Country[]>(`/countries${buildQuery({ active_only: activeOnly ? 'true' : 'false' })}`),

  getCountry: (id: number) => fetchApi<Country>(`/countries/${id}`),

  createCountry: (data: CountryCreatePayload) =>
    fetchApi<Country>('/countries', { method: 'POST', body: JSON.stringify(data) }),

  updateCountry: (id: number, data: CountryUpdatePayload) =>
    fetchApi<Country>(`/countries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteCountry: (id: number) =>
    fetchApi<{ deleted: boolean; country_id: number; iso_code: string }>(`/countries/${id}`, { method: 'DELETE' }),

  getDepartments: (activeOnly = false) =>
    fetchApi<Department[]>(`/departments${buildQuery({ active_only: activeOnly ? 'true' : 'false' })}`),

  getDepartment: (id: number) => fetchApi<Department>(`/departments/${id}`),

  createDepartment: (data: DepartmentCreatePayload) =>
    fetchApi<Department>('/departments', { method: 'POST', body: JSON.stringify(data) }),

  updateDepartment: (id: number, data: DepartmentUpdatePayload) =>
    fetchApi<Department>(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteDepartment: (id: number) =>
    fetchApi<{ deleted: boolean; department_id: number; code: string }>(`/departments/${id}`, { method: 'DELETE' }),

  getJobLevels: (activeOnly = false) =>
    fetchApi<JobLevel[]>(`/job-levels${buildQuery({ active_only: activeOnly ? 'true' : 'false' })}`),

  getJobLevel: (id: number) => fetchApi<JobLevel>(`/job-levels/${id}`),

  createJobLevel: (data: JobLevelCreatePayload) =>
    fetchApi<JobLevel>('/job-levels', { method: 'POST', body: JSON.stringify(data) }),

  updateJobLevel: (id: number, data: JobLevelUpdatePayload) =>
    fetchApi<JobLevel>(`/job-levels/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteJobLevel: (id: number) =>
    fetchApi<{ deleted: boolean; job_level_id: number; code: string }>(`/job-levels/${id}`, { method: 'DELETE' }),

  getCurrencies: (activeOnly = false) =>
    fetchApi<Currency[]>(`/currencies${buildQuery({ active_only: activeOnly ? 'true' : 'false' })}`),
};
