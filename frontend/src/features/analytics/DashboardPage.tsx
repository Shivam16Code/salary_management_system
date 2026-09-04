import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { readSessionJson, writeSessionJson, SESSION_FILTER_KEYS } from '@/shared/lib/sessionState';
import {
  Users, DollarSign, TrendingUp, BarChart2, Calendar, Filter,
  CheckCircle2, Clock, FileText, Download, Percent, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import {
  api, formatCurrency, formatCompactCurrency, queryKeys, selectClass, inputClass, labelClass,
  type Country, type Department, type JobLevel,
} from '@/shared/api';
import PageHeader from '@/shared/ui/PageHeader';
import { Card } from '@/shared/ui/Card';
import { FetchingIndicator } from '@/shared/ui/Spinner';
import Button from '@/shared/ui/Button';
import MultiSelect from '@/shared/ui/MultiSelect';
import FilterChip from '@/shared/ui/FilterChip';
import MetricCard from '@/shared/ui/MetricCard';
import {
  EMPLOYMENT_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  RECORD_STATUS_OPTIONS,
} from '@/shared/constants/filterOptions';
import ChartCard from './components/ChartCard';
import BreakdownTable from './components/BreakdownTable';
import InsightCard from './components/InsightCard';
import { buildEmployeesDrillUrl, buildSalaryRecordsDrillUrl } from './drillUrls';
import { exportAnalyticsCsv } from './exportCsv';
import {
  defaultFilters, filtersKey, formatDateLabel, isDateRangeInvalid,
  monthStartIso, monthsAgoIso, pct, todayIso, toAnalyticsFilters, yearStartIso,
} from './filters';
import type { AnalyticsTab, DateMode, DashboardFilterState } from './types';
import { PIE_COLORS } from './types';

type StoredDashboardFilters = {
  draft: DashboardFilterState;
  applied: DashboardFilterState;
  hasApplied: boolean;
  activeTab: AnalyticsTab;
};

export default function DashboardPage() {
  const stored = useMemo(
    () => readSessionJson<StoredDashboardFilters>(SESSION_FILTER_KEYS.dashboard),
    [],
  );
  const [draft, setDraft] = useState<DashboardFilterState>(() => stored?.draft ?? defaultFilters());
  const [applied, setApplied] = useState<DashboardFilterState>(() => stored?.applied ?? defaultFilters());
  const [hasApplied, setHasApplied] = useState(() => Boolean(stored?.hasApplied));
  const [activeTab, setActiveTab] = useState<AnalyticsTab>(() => stored?.activeTab ?? 'overview');

  useEffect(() => {
    writeSessionJson(SESSION_FILTER_KEYS.dashboard, {
      draft,
      applied,
      hasApplied,
      activeTab,
    } satisfies StoredDashboardFilters);
  }, [draft, applied, hasApplied, activeTab]);

  const rangeInvalid = draft.dateMode === 'range' && isDateRangeInvalid(draft.dateFrom, draft.dateTo);
  const filtersDirty = filtersKey(draft) !== filtersKey(applied);

  const analyticsFilters = useMemo(() => toAnalyticsFilters(applied), [applied]);
  const appliedFilterKey = useMemo(() => filtersKey(applied), [applied]);

  const { data: currencies } = useQuery({ queryKey: [queryKeys.currencies, true], queryFn: () => api.getCurrencies(true) });
  const { data: countries } = useQuery({ queryKey: [queryKeys.countries, true], queryFn: () => api.getCountries(true) });
  const { data: departments } = useQuery({ queryKey: [queryKeys.departments, true], queryFn: () => api.getDepartments(true) });
  const { data: jobLevels } = useQuery({ queryKey: [queryKeys.jobLevels, true], queryFn: () => api.getJobLevels(true) });

  const { data: filtered, isLoading, isFetching, isError, error } = useQuery({
    queryKey: [queryKeys.analyticsFiltered, appliedFilterKey],
    queryFn: () => api.getFilteredAnalytics(applied.reportingCurrency, analyticsFilters),
    enabled: hasApplied,
  });

  const isRefreshing = isFetching && !!filtered;

  const applyFilters = () => {
    if (rangeInvalid) return;
    setHasApplied(true);
    setApplied(draft);
    setActiveTab('overview');
  };

  const resetDraft = () => setDraft(applied);

  const applyPreset = (preset: 'today' | 'month' | 'quarter' | 'ytd') => {
    const today = todayIso();
    if (preset === 'today') {
      setDraft((d) => ({ ...d, dateMode: 'snapshot', asOfDate: today, dateFrom: '', dateTo: '' }));
      return;
    }
    const from = preset === 'month' ? monthStartIso()
      : preset === 'quarter' ? monthsAgoIso(2)
        : yearStartIso();
    setDraft((d) => ({
      ...d,
      dateMode: 'range',
      dateFrom: from,
      dateTo: today,
      asOfDate: today,
    }));
  };

  const dateLabel = formatDateLabel(applied.dateMode, applied.asOfDate, applied.dateFrom, applied.dateTo);
  const appliedDateText = applied.dateMode === 'snapshot'
    ? `Snapshot · ${dateLabel}`
    : `Salary records · ${dateLabel}`;

  const lookupName = (
    id: number,
    list: Country[] | Department[] | JobLevel[] | undefined,
  ) => list?.find((x) => x.id === id)?.name ?? id;

  const summary = filtered?.summary;
  const paymentSummary = filtered?.payment_summary;
  const distribution = filtered?.distribution;
  const trend = filtered?.trend;
  const showTrend = hasApplied && applied.dateMode === 'range' && !!applied.dateFrom && !!applied.dateTo
    && applied.dateFrom <= applied.dateTo && !!trend;

  const distData = distribution?.buckets.map((b) => ({
    name: b.range_label,
    value: b.employee_count,
    pct: Number(b.percentage),
  })) ?? [];

  const paidRate = paymentSummary && paymentSummary.total_records
    ? pct(paymentSummary.paid_count, paymentSummary.total_records)
    : 0;
  const avgMedianGap = summary
    ? Number(summary.average_compensation) - Number(summary.median_compensation)
    : 0;
  const headcountDelta = filtered?.range_start_summary && filtered?.range_end_summary
    ? filtered.range_end_summary.employee_count - filtered.range_start_summary.employee_count
    : null;

  const trendSubtitle = (() => {
    if (!applied.dateFrom || !applied.dateTo) return '';
    const from = new Date(applied.dateFrom);
    const to = new Date(applied.dateTo);
    const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    if (days <= 14) return 'daily snapshots';
    if (days <= 90) return 'weekly snapshots';
    return 'monthly snapshots';
  })();

  const tabs: { id: AnalyticsTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'compensation', label: 'Compensation' },
    { id: 'payments', label: 'Payments' },
    { id: 'trends', label: 'Trends' },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="Compensation Analytics"
        subtitle={
          hasApplied && filtered
            ? `${appliedDateText} · ${applied.reportingCurrency}`
            : 'ERP payroll analytics — apply filters to generate a report'
        }
        meta={(
          <div className="flex items-center gap-2 flex-wrap">
            {isRefreshing && <FetchingIndicator show />}
            {hasApplied && filtered && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => exportAnalyticsCsv(filtered, applied, dateLabel)}
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            )}
          </div>
        )}
      />

      <Card padding>
        <div className="flex items-center gap-2 mb-1">
          <Filter className="w-5 h-5 text-slate-400" aria-hidden />
          <h3 className="section-title">Report Filters</h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Set scope, then click <strong>Apply Filters</strong>. Default record type is{' '}
          <strong>current period (Active)</strong> for accurate headcount.
        </p>

        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Quick dates</p>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'today' as const, label: 'Today' },
              { id: 'month' as const, label: 'This month' },
              { id: 'quarter' as const, label: 'Last 3 months' },
              { id: 'ytd' as const, label: 'Year to date' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="filter-panel">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <p className="text-sm font-semibold text-slate-700">Date range</p>
            </div>
            <div>
              <label className={labelClass}>View type</label>
              <select
                className={selectClass}
                value={draft.dateMode}
                onChange={(e) => setDraft({ ...draft, dateMode: e.target.value as DateMode })}
              >
                <option value="snapshot">Single date (snapshot)</option>
                <option value="range">Date range (period start in range)</option>
              </select>
            </div>
            {draft.dateMode === 'range' && (
              <p className="text-xs text-slate-500 -mt-1">
                Includes records whose pay period <strong>starts</strong> between From and To.
              </p>
            )}
            {draft.dateMode === 'snapshot' ? (
              <div>
                <label className={labelClass}>As of date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={draft.asOfDate}
                  onChange={(e) => setDraft({ ...draft, asOfDate: e.target.value })}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>From</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={draft.dateFrom}
                    max={draft.dateTo || undefined}
                    onChange={(e) => setDraft({ ...draft, dateFrom: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass}>To</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={draft.dateTo}
                    min={draft.dateFrom || undefined}
                    onChange={(e) => setDraft({ ...draft, dateTo: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="filter-panel">
            <p className="text-sm font-semibold text-slate-700">Employee scope</p>
            <MultiSelect
              label="Department"
              placeholder="All departments"
              options={departments?.map((d) => ({ value: d.id, label: d.name })) ?? []}
              value={draft.departmentIds}
              onChange={(departmentIds) => setDraft({ ...draft, departmentIds })}
            />
            <MultiSelect
              label="Job Level"
              placeholder="All job levels"
              options={jobLevels?.map((l) => ({ value: l.id, label: l.name })) ?? []}
              value={draft.jobLevelIds}
              onChange={(jobLevelIds) => setDraft({ ...draft, jobLevelIds })}
            />
            <MultiSelect
              label="Employee status"
              placeholder="All statuses"
              options={EMPLOYMENT_STATUS_OPTIONS}
              value={draft.employmentStatuses}
              onChange={(employmentStatuses) => setDraft({ ...draft, employmentStatuses })}
            />
            <MultiSelect
              label="Record type"
              placeholder="All record types"
              options={RECORD_STATUS_OPTIONS}
              value={draft.recordStatuses}
              onChange={(recordStatuses) => setDraft({ ...draft, recordStatuses })}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Min salary ({draft.reportingCurrency})</label>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  placeholder="Any"
                  value={draft.salaryMin}
                  onChange={(e) => setDraft({ ...draft, salaryMin: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Max salary ({draft.reportingCurrency})</label>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  placeholder="Any"
                  value={draft.salaryMax}
                  onChange={(e) => setDraft({ ...draft, salaryMax: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="filter-panel flex flex-col">
            <p className="text-sm font-semibold text-slate-700">Payment & display</p>
            <MultiSelect
              label="Payment status"
              placeholder="All (paid & not paid)"
              options={PAYMENT_STATUS_OPTIONS}
              value={draft.paymentStatuses}
              onChange={(paymentStatuses) => setDraft({ ...draft, paymentStatuses })}
            />
            <MultiSelect
              label="Currency"
              placeholder="All currencies"
              options={currencies?.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })) ?? []}
              value={draft.currencyIds}
              onChange={(currencyIds) => setDraft({ ...draft, currencyIds })}
            />
            <p className="text-xs text-slate-500 -mt-1">
              Filters employees and By Country results to countries that use the selected currency.
            </p>
            <div>
              <label className={labelClass}>Reporting currency</label>
              <select
                className={selectClass}
                value={draft.reportingCurrency}
                onChange={(e) => setDraft({ ...draft, reportingCurrency: e.target.value })}
              >
                {currencies?.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 mt-auto pt-2">
              <Button
                type="button"
                onClick={applyFilters}
                disabled={rangeInvalid || isFetching || (hasApplied && !filtersDirty)}
              >
                {isFetching && hasApplied ? 'Updating…' : 'Apply Filters'}
              </Button>
              {filtersDirty && (
                <Button type="button" variant="secondary" onClick={resetDraft}>
                  Discard changes
                </Button>
              )}
            </div>
          </div>
        </div>

        {rangeInvalid && (
          <p className="text-xs text-red-600 mt-3">Start date must be on or before end date.</p>
        )}
        {filtersDirty && !rangeInvalid && (
          <p className="text-xs text-amber-600 mt-3">Filters changed — click Apply Filters to refresh the report.</p>
        )}
        {isError && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-700 font-medium">Failed to load analytics</p>
            <p className="text-xs text-red-600 mt-1">{error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
          <span className="text-xs text-slate-500 self-center mr-1">Report scope:</span>
          <FilterChip label={appliedDateText} />
          <FilterChip label={`Currency: ${applied.reportingCurrency}`} />
          {applied.departmentIds.map((id) => (
            <FilterChip key={`dept-${id}`} label={`Dept: ${lookupName(id, departments)}`} />
          ))}
          {applied.jobLevelIds.map((id) => (
            <FilterChip key={`level-${id}`} label={`Job Level: ${lookupName(id, jobLevels)}`} />
          ))}
          {applied.paymentStatuses.map((status) => (
            <FilterChip
              key={`pay-${status}`}
              label={`Payment: ${status === 'PAID' ? 'Paid' : 'Not paid'}`}
            />
          ))}
          {applied.employmentStatuses.map((status) => (
            <FilterChip
              key={`emp-${status}`}
              label={`Employee: ${EMPLOYMENT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}`}
            />
          ))}
          {applied.recordStatuses.map((status) => (
            <FilterChip
              key={`rec-${status}`}
              label={RECORD_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}
            />
          ))}
          {applied.currencyIds.map((id) => (
            <FilterChip
              key={`cur-${id}`}
              label={`Pay currency: ${currencies?.find((c) => c.id === id)?.code ?? id}`}
            />
          ))}
          {summary && (
            <span className="text-xs text-slate-500 self-center ml-auto tabular-nums">
              {summary.employee_count.toLocaleString()} employees ·{' '}
              {paymentSummary?.total_records.toLocaleString() ?? 0} records
            </span>
          )}
        </div>
      </Card>

      {!hasApplied ? (
        <Card padding className="text-center py-16">
          <BarChart2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Choose date range and organizational filters, then click <strong>Apply Filters</strong> to generate
            the compensation report.
          </p>
        </Card>
      ) : filtered ? (
        <div className="space-y-4 sm:space-y-6">
          <Card padding className="border-brand-100 bg-brand-50/30">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-brand-800 uppercase tracking-wide mb-1">Filtered report</p>
                <p className="text-sm text-slate-700">
                  {appliedDateText} · Reporting in {applied.reportingCurrency}
                </p>
                {applied.dateMode === 'range' && filtered.range_start_summary && filtered.range_end_summary && (
                  <p className="text-xs text-slate-500 mt-2 tabular-nums">
                    Period start: {filtered.range_start_summary.employee_count.toLocaleString()} ·{' '}
                    Period end: {filtered.range_end_summary.employee_count.toLocaleString()} ·{' '}
                    Range cohort: {summary?.employee_count.toLocaleString()} employees
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={buildEmployeesDrillUrl(applied)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  View employees
                </Link>
                <Link
                  to={buildSalaryRecordsDrillUrl(applied)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                >
                  View salary records
                </Link>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <InsightCard
              title="Paid rate"
              value={`${paidRate.toFixed(1)}%`}
              hint={paymentSummary ? `${paymentSummary.paid_count.toLocaleString()} of ${paymentSummary.total_records.toLocaleString()} records` : undefined}
              tone={paidRate >= 85 ? 'good' : paidRate >= 60 ? 'info' : 'warn'}
            />
            <InsightCard
              title="Unpaid liability"
              value={formatCompactCurrency(paymentSummary?.total_not_paid_amount ?? 0, applied.reportingCurrency)}
              hint={paymentSummary ? `${paymentSummary.not_paid_count.toLocaleString()} unpaid records` : undefined}
              tone={(paymentSummary?.not_paid_count ?? 0) > 0 ? 'warn' : 'good'}
            />
            <InsightCard
              title="Avg vs median gap"
              value={formatCompactCurrency(avgMedianGap, applied.reportingCurrency)}
              hint="Positive gap means high earners pull the average up"
              tone="info"
            />
            <InsightCard
              title="Headcount change"
              value={
                headcountDelta == null
                  ? '—'
                  : `${headcountDelta > 0 ? '+' : ''}${headcountDelta.toLocaleString()}`
              }
              hint={
                headcountDelta == null
                  ? 'Available in date-range mode with From & To'
                  : 'Period end vs period start'
              }
              tone={headcountDelta == null ? 'neutral' : headcountDelta >= 0 ? 'good' : 'warn'}
            />
          </div>

          <div className="tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={activeTab === t.id ? 'tab-active' : 'tab-inactive'}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Employees"
                  value={summary?.employee_count.toLocaleString() ?? '0'}
                  icon={Users}
                  color="bg-blue-500"
                />
                <MetricCard
                  title="Average Compensation"
                  value={formatCompactCurrency(summary?.average_compensation ?? 0, applied.reportingCurrency)}
                  icon={TrendingUp}
                  color="bg-emerald-500"
                />
                <MetricCard
                  title="Median Compensation"
                  value={formatCompactCurrency(summary?.median_compensation ?? 0, applied.reportingCurrency)}
                  icon={BarChart2}
                  color="bg-violet-500"
                />
                <MetricCard
                  title="Total Compensation"
                  value={formatCompactCurrency(summary?.total_compensation ?? 0, applied.reportingCurrency)}
                  subtitle={
                    summary
                      ? `Min ${formatCompactCurrency(summary.min_compensation, applied.reportingCurrency)} · Max ${formatCompactCurrency(summary.max_compensation, applied.reportingCurrency)}`
                      : undefined
                  }
                  icon={DollarSign}
                  color="bg-amber-500"
                />
              </div>

              <Card padding>
                <h3 className="section-title mb-1">Executive summary</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  This report covers <strong>{summary?.employee_count.toLocaleString() ?? 0}</strong> employees
                  with total payroll of{' '}
                  <strong>{formatCompactCurrency(summary?.total_compensation ?? 0, applied.reportingCurrency)}</strong>.
                  Payment completion is <strong>{paidRate.toFixed(1)}%</strong>
                  {paymentSummary && paymentSummary.not_paid_count > 0
                    ? `, leaving ${formatCompactCurrency(paymentSummary.total_not_paid_amount, applied.reportingCurrency)} unpaid across ${paymentSummary.not_paid_count.toLocaleString()} records.`
                    : '. All matching records are marked paid.'}
                  {avgMedianGap > 0
                    ? ` Average pay exceeds median by ${formatCompactCurrency(avgMedianGap, applied.reportingCurrency)}, indicating pay concentration at higher bands.`
                    : ''}
                </p>
              </Card>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                <Card padding>
                  <h3 className="section-title mb-1">Compensation Distribution</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    {dateLabel}
                    {distribution ? ` · ${distribution.total_employees.toLocaleString()} employees` : ''}
                  </p>
                  {distData.length > 0 && distData.some((d) => d.value > 0) ? (
                    <div className="w-full h-[260px] sm:h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={distData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%">
                            {distData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v) => [`${v} employees`]} />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-slate-400 text-center py-12 text-sm">No distribution data</p>
                  )}
                </Card>
                <ChartCard
                  title="Average by Department"
                  data={filtered.by_department}
                  currency={applied.reportingCurrency}
                  dateHint={dateLabel}
                />
              </div>
            </div>
          )}

          {activeTab === 'compensation' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard
                  title="Employees"
                  value={summary?.employee_count.toLocaleString() ?? '0'}
                  icon={Users}
                  color="bg-blue-500"
                />
                <MetricCard
                  title="Average"
                  value={formatCompactCurrency(summary?.average_compensation ?? 0, applied.reportingCurrency)}
                  icon={TrendingUp}
                  color="bg-emerald-500"
                />
                <MetricCard
                  title="Median"
                  value={formatCompactCurrency(summary?.median_compensation ?? 0, applied.reportingCurrency)}
                  icon={BarChart2}
                  color="bg-violet-500"
                />
                <MetricCard
                  title="Total payroll"
                  value={formatCompactCurrency(summary?.total_compensation ?? 0, applied.reportingCurrency)}
                  icon={DollarSign}
                  color="bg-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                <ChartCard
                  title="Average by Country"
                  data={filtered.by_country}
                  currency={applied.reportingCurrency}
                  dateHint={dateLabel}
                />
                <ChartCard
                  title="Average by Job Level"
                  data={filtered.by_job_level}
                  currency={applied.reportingCurrency}
                  dateHint={dateLabel}
                />
              </div>

              <BreakdownTable
                title="By Country"
                data={filtered.by_country}
                currency={applied.reportingCurrency}
                filters={applied}
                dimension="country"
                countries={countries}
              />
              <BreakdownTable
                title="By Department"
                data={filtered.by_department}
                currency={applied.reportingCurrency}
                filters={applied}
                dimension="department"
                departments={departments}
              />
              <BreakdownTable
                title="By Job Level"
                data={filtered.by_job_level}
                currency={applied.reportingCurrency}
                filters={applied}
                dimension="level"
                jobLevels={jobLevels}
              />
            </div>
          )}

          {activeTab === 'payments' && paymentSummary && (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard
                  title="Salary Records"
                  value={paymentSummary.total_records.toLocaleString()}
                  subtitle={`${paymentSummary.employee_count.toLocaleString()} unique employees`}
                  icon={FileText}
                  color="bg-slate-600"
                />
                <MetricCard
                  title="Total Paid"
                  value={formatCompactCurrency(paymentSummary.total_paid_amount, paymentSummary.reporting_currency)}
                  subtitle={`${paymentSummary.paid_count.toLocaleString()} paid records`}
                  icon={CheckCircle2}
                  color="bg-emerald-600"
                />
                <MetricCard
                  title="Total Unpaid"
                  value={formatCompactCurrency(paymentSummary.total_not_paid_amount, paymentSummary.reporting_currency)}
                  subtitle={`${paymentSummary.not_paid_count.toLocaleString()} unpaid records`}
                  icon={Clock}
                  color="bg-orange-500"
                />
                <MetricCard
                  title="Paid vs Unpaid"
                  value={`${paymentSummary.paid_count.toLocaleString()} / ${paymentSummary.not_paid_count.toLocaleString()}`}
                  subtitle="Record counts"
                  icon={Percent}
                  color="bg-indigo-500"
                />
              </div>

              <Card padding>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="section-title">Payment completion</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {paidRate.toFixed(1)}% of filtered records are paid
                    </p>
                  </div>
                  <Link
                    to={buildSalaryRecordsDrillUrl(applied, { paymentStatuses: ['NOT_PAID'] })}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  >
                    Open unpaid records
                  </Link>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.min(100, paidRate)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-500 tabular-nums">
                  <span>Paid {formatCompactCurrency(paymentSummary.total_paid_amount, applied.reportingCurrency)}</span>
                  <span>Unpaid {formatCompactCurrency(paymentSummary.total_not_paid_amount, applied.reportingCurrency)}</span>
                </div>
              </Card>

              <Card padding>
                <h3 className="section-title mb-2">Liability focus</h3>
                <p className="text-sm text-slate-600">
                  Outstanding unpaid amount under current filters is{' '}
                  <strong>{formatCompactCurrency(paymentSummary.total_not_paid_amount, applied.reportingCurrency)}</strong>
                  {' '}across <strong>{paymentSummary.not_paid_count.toLocaleString()}</strong> records.
                  Use the unpaid drill-down to process payments in Salary Records.
                </p>
              </Card>
            </div>
          )}

          {activeTab === 'trends' && (
            <div className="space-y-4">
              {!showTrend ? (
                <Card padding className="text-center py-12">
                  <TrendingUp className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 max-w-md mx-auto">
                    Trends require <strong>Date range</strong> view with both <strong>From</strong> and{' '}
                    <strong>To</strong> dates. Switch view type, set dates, and apply filters.
                  </p>
                </Card>
              ) : (
                <Card padding>
                  <h3 className="section-title mb-1">Compensation Trend</h3>
                  <p className="text-xs text-slate-400 mb-4">{dateLabel} · {trendSubtitle}</p>
                  {trend && trend.points.length > 0 ? (
                    <>
                      <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trend.points.map((p) => ({
                            name: p.period_label,
                            avg: Number(p.average_compensation),
                            total: Number(p.total_compensation),
                            count: p.employee_count,
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis
                              yAxisId="avg"
                              tick={{ fontSize: 11 }}
                              tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}K`}
                              width={48}
                            />
                            <YAxis
                              yAxisId="total"
                              orientation="right"
                              tick={{ fontSize: 11 }}
                              tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(0)}M`}
                              width={52}
                            />
                            <Tooltip
                              formatter={(value, name) => [
                                formatCurrency(Number(value), '', applied.reportingCurrency),
                                name === 'avg' ? 'Avg Compensation' : 'Total Compensation',
                              ]}
                              labelFormatter={(label) => `${label} · ${trend.points.find((p) => p.period_label === label)?.employee_count ?? 0} employees`}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            <Line yAxisId="avg" type="monotone" dataKey="avg" name="Avg Compensation" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                            <Line yAxisId="total" type="monotone" dataKey="total" name="Total Compensation" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="text-xs text-slate-500 mt-4">
                        Relationship: <strong>Total ≈ Average × Headcount</strong>. If average falls while total rises,
                        headcount grew with lower-paid joiners. Hover points to compare employee counts.
                      </p>
                    </>
                  ) : (
                    <p className="text-slate-400 text-center py-12 text-sm">No trend data for this date range and filters</p>
                  )}
                </Card>
              )}

              {headcountDelta != null && (
                <Card padding>
                  <div className="flex items-start gap-3">
                    {headcountDelta >= 0 ? (
                      <ArrowUpRight className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h3 className="section-title">Headcount movement</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        Net change from period start to end:{' '}
                        <strong>
                          {headcountDelta > 0 ? '+' : ''}
                          {headcountDelta.toLocaleString()}
                        </strong>
                        {' '}employees
                        {filtered.range_start_summary && filtered.range_end_summary && (
                          <>
                            {' '}({filtered.range_start_summary.employee_count.toLocaleString()} →{' '}
                            {filtered.range_end_summary.employee_count.toLocaleString()})
                          </>
                        )}.
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      ) : (
        <Card padding className="text-center py-16">
          <FetchingIndicator show={isFetching || isLoading} label="Loading report" />
        </Card>
      )}
    </div>
  );
}
