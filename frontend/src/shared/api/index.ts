import { analyticsApi } from './analytics';
import { employeesApi } from './employees';
import { exchangeRatesApi } from './exchangeRates';
import { masterDataApi } from './masterData';
import { salariesApi } from './salaries';
import { salaryComponentsApi } from './salaryComponents';

export * from './types';
export * from './http';
export * from './format';
export * from './formClasses';
export * from './employees';
export * from './salaries';
export * from './salaryComponents';
export * from './masterData';
export * from './analytics';
export * from './exchangeRates';
export * from './queryKeys';

/** Unified API surface — same method names as the former client.ts. */
export const api = {
  ...employeesApi,
  ...salariesApi,
  ...salaryComponentsApi,
  ...masterDataApi,
  ...exchangeRatesApi,
  ...analyticsApi,
};
