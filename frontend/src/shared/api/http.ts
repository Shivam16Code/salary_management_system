const API_BASE = '/api/v1';

const FIELD_LABELS: Record<string, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  email: 'Email',
  employee_code: 'Employee code',
  country_id: 'Country',
  department_id: 'Department',
  job_level_id: 'Job level',
  job_title: 'Job title',
  hire_date: 'Hire date',
  employment_status: 'Status',
  iso_code: 'Country code',
  code: 'Code',
  name: 'Name',
  currency_id: 'Currency',
  package_amount: 'Package amount',
  pay_frequency: 'Pay frequency',
  effective_from: 'Start date',
  effective_to: 'End date',
  amount: 'Amount',
  units: 'Units',
  salary_component_id: 'Salary component',
};

type ErrorDetail = { field?: string; message?: string };
type ErrorBody = {
  error?: { code?: string; message?: string; details?: ErrorDetail[] };
  detail?: unknown;
};

function fieldLabel(field?: string): string {
  if (!field) return '';
  const key = field.split('.').pop() || field;
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  if (/^\d+$/.test(key)) return '';
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function looksTechnical(text: string): boolean {
  return /duplicate key|unique constraint|violates|ix_\w+|DETAIL:|Key \(/i.test(text);
}

function formatDetail(detail: ErrorDetail): string {
  const message = (detail.message || '').trim();
  if (!message || looksTechnical(message)) return '';
  const label = fieldLabel(detail.field);
  if (label && !message.toLowerCase().startsWith(label.toLowerCase())) {
    return `${label}: ${message}`;
  }
  return message;
}

/** Parse central backend error envelope into a short, user-facing sentence. */
export function formatApiError(err: unknown, fallback = 'Request failed'): string {
  if (!err || typeof err !== 'object') return fallback;
  const body = err as ErrorBody;

  if (body.error?.message) {
    const details = (body.error.details || []).map(formatDetail).filter(Boolean);
    const summary = looksTechnical(body.error.message) ? '' : body.error.message.trim();

    if (body.error.code === 'VALIDATION_ERROR' && details.length > 0) {
      return details.join(' ');
    }
    if (summary) return summary;
    if (details.length > 0) return details.join(' ');
    return 'This change could not be saved. Please check the form and try again.';
  }

  if (typeof body.detail === 'string' && !looksTechnical(body.detail)) return body.detail;
  return fallback;
}

export type QueryValue = string | number | boolean | undefined | null | (string | number)[];

export function buildQuery(params: Record<string, QueryValue>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) {
      if (v.length === 0) return;
      v.forEach((item) => qs.append(k, String(item)));
    } else {
      qs.set(k, String(v));
    }
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error(
      'Cannot reach the API server. Start the backend with: cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000',
    );
  }
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(formatApiError(err, res.statusText));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
