/** React Query cache keys — kebab-case to match API path segments. */
export const queryKeys = {
  countries: 'countries',
  countryReference: 'country-reference',
  currencies: 'currencies',
  departments: 'departments',
  jobLevels: 'job-levels',
  employees: 'employees',
  employee: 'employee',
  salaryRecords: 'salary-records',
  salaryComponents: 'salary-components',
  salaryProfileHistory: 'salary-profile-history',
  salaryProfilePreview: 'salary-profile-preview',
  analyticsFiltered: 'analytics-filtered',
  exchangeRates: 'exchange-rates',
  exchangeRatePair: 'exchange-rate-pair',
} as const;
