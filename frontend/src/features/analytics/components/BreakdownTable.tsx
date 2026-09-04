import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AnalyticsBreakdown, Country, Department, JobLevel } from '@/shared/api';
import { formatCompactCurrency } from '@/shared/api';
import { Card } from '@/shared/ui/Card';
import { buildEmployeesDrillUrl } from '../drillUrls';
import { pct } from '../filters';
import type { BreakdownSortKey, DashboardFilterState } from '../types';

export default function BreakdownTable({
  title,
  data,
  currency,
  filters,
  dimension,
  countries,
  departments,
  jobLevels,
}: {
  title: string;
  data: AnalyticsBreakdown[];
  currency: string;
  filters: DashboardFilterState;
  dimension: 'country' | 'department' | 'level';
  countries?: Country[];
  departments?: Department[];
  jobLevels?: JobLevel[];
}) {
  const [sortKey, setSortKey] = useState<BreakdownSortKey>('total');
  const [sortAsc, setSortAsc] = useState(false);

  const headcount = data.reduce((s, r) => s + r.employee_count, 0);
  const payroll = data.reduce((s, r) => s + Number(r.total_compensation), 0);

  const sorted = useMemo(() => {
    const rows = [...data];
    rows.sort((a, b) => {
      const av = sortKey === 'employees' ? a.employee_count
        : sortKey === 'avg' ? Number(a.average_compensation)
          : Number(a.total_compensation);
      const bv = sortKey === 'employees' ? b.employee_count
        : sortKey === 'avg' ? Number(b.average_compensation)
          : Number(b.total_compensation);
      return sortAsc ? av - bv : bv - av;
    });
    return rows;
  }, [data, sortKey, sortAsc]);

  const toggleSort = (key: BreakdownSortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const drillFor = (row: AnalyticsBreakdown) => {
    if (dimension === 'country') {
      const match = countries?.find(
        (c) => c.iso_code === row.group_key || c.name === row.group_label,
      );
      return buildEmployeesDrillUrl(filters, {
        currencyIds: match ? [match.currency_id] : filters.currencyIds,
      });
    }
    if (dimension === 'department') {
      const match = departments?.find(
        (d) => d.code === row.group_key || d.name === row.group_label,
      );
      return buildEmployeesDrillUrl(filters, {
        departmentIds: match ? [match.id] : filters.departmentIds,
      });
    }
    const match = jobLevels?.find(
      (l) => l.code === row.group_key || l.name === row.group_label,
    );
    return buildEmployeesDrillUrl(filters, {
      jobLevelIds: match ? [match.id] : filters.jobLevelIds,
    });
  };

  return (
    <Card padding>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="section-title">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{data.length} groups · {headcount.toLocaleString()} employees</p>
        </div>
      </div>
      {sorted.length === 0 ? (
        <p className="text-slate-400 text-center py-8 text-sm">No breakdown data</p>
      ) : (
        <div className="table-wrap">
          <table className="table min-w-[720px]">
            <thead>
              <tr>
                <th>Group</th>
                <th className="text-right">
                  <button type="button" className="font-medium" onClick={() => toggleSort('employees')}>
                    Employees{sortKey === 'employees' ? (sortAsc ? ' ↑' : ' ↓') : ''}
                  </button>
                </th>
                <th className="text-right">% Headcount</th>
                <th className="text-right">
                  <button type="button" className="font-medium" onClick={() => toggleSort('avg')}>
                    Avg pay{sortKey === 'avg' ? (sortAsc ? ' ↑' : ' ↓') : ''}
                  </button>
                </th>
                <th className="text-right">
                  <button type="button" className="font-medium" onClick={() => toggleSort('total')}>
                    Total pay{sortKey === 'total' ? (sortAsc ? ' ↑' : ' ↓') : ''}
                  </button>
                </th>
                <th className="text-right">% Payroll</th>
                <th className="text-right">Drill</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.group_key}>
                  <td className="font-medium text-slate-800">{row.group_label}</td>
                  <td className="text-right tabular-nums">{row.employee_count.toLocaleString()}</td>
                  <td className="text-right tabular-nums text-slate-500">
                    {pct(row.employee_count, headcount).toFixed(1)}%
                  </td>
                  <td className="text-right tabular-nums">
                    {formatCompactCurrency(Number(row.average_compensation), currency)}
                  </td>
                  <td className="text-right tabular-nums font-medium">
                    {formatCompactCurrency(Number(row.total_compensation), currency)}
                  </td>
                  <td className="text-right tabular-nums text-slate-500">
                    {pct(Number(row.total_compensation), payroll).toFixed(1)}%
                  </td>
                  <td className="text-right">
                    <Link
                      to={drillFor(row)}
                      className="text-xs font-medium text-brand-600 hover:text-brand-800"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
