import type { AnalyticsBreakdown, AnalyticsFiltered } from '@/shared/api';
import { pct, todayIso } from './filters';
import type { DashboardFilterState } from './types';

export function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportAnalyticsCsv(
  filtered: AnalyticsFiltered,
  filters: DashboardFilterState,
  dateLabel: string,
) {
  const lines: string[] = [];
  const push = (...cols: (string | number)[]) => lines.push(cols.map(csvEscape).join(','));

  push('Section', 'Metric', 'Value', 'Currency');
  push('Report', 'Period', dateLabel, '');
  push('Report', 'Reporting currency', filters.reportingCurrency, '');
  push('Summary', 'Employees', filtered.summary.employee_count, '');
  push('Summary', 'Average compensation', Number(filtered.summary.average_compensation), filters.reportingCurrency);
  push('Summary', 'Median compensation', Number(filtered.summary.median_compensation), filters.reportingCurrency);
  push('Summary', 'Total compensation', Number(filtered.summary.total_compensation), filters.reportingCurrency);
  push('Summary', 'Min compensation', Number(filtered.summary.min_compensation), filters.reportingCurrency);
  push('Summary', 'Max compensation', Number(filtered.summary.max_compensation), filters.reportingCurrency);
  push('Payments', 'Total records', filtered.payment_summary.total_records, '');
  push('Payments', 'Unique employees', filtered.payment_summary.employee_count, '');
  push('Payments', 'Paid count', filtered.payment_summary.paid_count, '');
  push('Payments', 'Unpaid count', filtered.payment_summary.not_paid_count, '');
  push('Payments', 'Total paid', Number(filtered.payment_summary.total_paid_amount), filters.reportingCurrency);
  push('Payments', 'Total unpaid', Number(filtered.payment_summary.total_not_paid_amount), filters.reportingCurrency);

  const writeBreakdown = (section: string, rows: AnalyticsBreakdown[]) => {
    push('');
    push(section, 'Group', 'Employees', 'Avg', 'Total', '% Headcount', '% Payroll');
    const headcount = rows.reduce((s, r) => s + r.employee_count, 0);
    const payroll = rows.reduce((s, r) => s + Number(r.total_compensation), 0);
    rows.forEach((r) => {
      push(
        section,
        r.group_label,
        r.employee_count,
        Number(r.average_compensation),
        Number(r.total_compensation),
        pct(r.employee_count, headcount).toFixed(2),
        pct(Number(r.total_compensation), payroll).toFixed(2),
      );
    });
  };

  writeBreakdown('By Country', filtered.by_country);
  writeBreakdown('By Department', filtered.by_department);
  writeBreakdown('By Job Level', filtered.by_job_level);

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = todayIso().replace(/-/g, '');
  a.href = url;
  a.download = `compensation-analytics-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
