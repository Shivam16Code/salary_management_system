/** Persist UI filter state across in-tab navigation (cleared when the tab closes). */

export function readSessionJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeSessionJson(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export const SESSION_FILTER_KEYS = {
  dashboard: 'sms.filters.dashboard',
  employees: 'sms.filters.employees',
  salaryRecords: 'sms.filters.salaryRecords',
} as const;
