import { buildQuery, fetchApi } from './http';

export interface SalaryComponent {
  id: number;
  code: string;
  name: string;
  component_type: string;
  calculation_method: string;
  is_taxable: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SalaryComponentCreatePayload {
  code: string;
  name: string;
  component_type: string;
  calculation_method: string;
  is_taxable?: boolean;
  is_active?: boolean;
}

export interface SalaryComponentUpdatePayload {
  name?: string;
  component_type?: string;
  calculation_method?: string;
  is_taxable?: boolean;
  is_active?: boolean;
}

export const salaryComponentsApi = {
  getSalaryComponents: (activeOnly = true) =>
    fetchApi<SalaryComponent[]>(`/salary-components${buildQuery({ active_only: activeOnly ? 'true' : 'false' })}`),

  createSalaryComponent: (data: SalaryComponentCreatePayload) =>
    fetchApi<SalaryComponent>('/salary-components', { method: 'POST', body: JSON.stringify(data) }),

  updateSalaryComponent: (id: number, data: SalaryComponentUpdatePayload) =>
    fetchApi<SalaryComponent>(`/salary-components/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteSalaryComponent: (id: number) =>
    fetchApi<{ deleted: boolean; component_id: number; code: string }>(
      `/salary-components/${id}`,
      { method: 'DELETE' },
    ),
};
