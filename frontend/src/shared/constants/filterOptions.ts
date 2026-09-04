/** Shared filter option constants used across analytics and list pages. */

export const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'ACTIVE' as const, label: 'Active' },
  { value: 'INACTIVE' as const, label: 'Inactive' },
  { value: 'TERMINATED' as const, label: 'Terminated' },
  { value: 'ON_LEAVE' as const, label: 'On leave' },
];

export const PAYMENT_STATUS_OPTIONS = [
  { value: 'PAID' as const, label: 'Paid' },
  { value: 'NOT_PAID' as const, label: 'Not paid' },
];

export const RECORD_STATUS_OPTIONS = [
  { value: 'ACTIVE' as const, label: 'Current period (Active)' },
  { value: 'INACTIVE' as const, label: 'Historical (Inactive)' },
];

export type EmploymentStatus = typeof EMPLOYMENT_STATUS_OPTIONS[number]['value'];
export type PaymentStatus = typeof PAYMENT_STATUS_OPTIONS[number]['value'];
export type RecordStatus = typeof RECORD_STATUS_OPTIONS[number]['value'];

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/** Parse repeated query params into positive integers. */
export function parseIntList(params: URLSearchParams, key: string): number[] {
  return params.getAll(key).map(Number).filter((n) => Number.isFinite(n) && n > 0);
}

export function parseJobTitles(raw: string): string[] {
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}
