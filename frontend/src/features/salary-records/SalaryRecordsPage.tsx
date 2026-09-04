import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { readSessionJson, writeSessionJson, SESSION_FILTER_KEYS } from '@/shared/lib/sessionState';
import {
  Calendar, ChevronLeft, ChevronRight, Filter, Search,
  CheckCircle2, Clock, FileText,
} from 'lucide-react';
import {
  api, formatCurrency, queryKeys,
  inputClass, selectClass, labelClass, btnSecondary,
} from '@/shared/api';
import PageHeader from '@/shared/ui/PageHeader';
import Badge, { employmentBadgeVariant } from '@/shared/ui/Badge';
import Button from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { FetchingIndicator } from '@/shared/ui/Spinner';
import MultiSelect from '@/shared/ui/MultiSelect';
import FilterChip from '@/shared/ui/FilterChip';
import MetricCard from '@/shared/ui/MetricCard';
import SortableHeader from '@/shared/ui/SortableHeader';
import {
  EMPLOYMENT_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  RECORD_STATUS_OPTIONS,
} from '@/shared/constants/filterOptions';
import SalaryRecordMobileCard from './components/SalaryRecordMobileCard';
import {
  defaultFilters,
  filtersFromSearchParams,
  toApiFilters,
  formatDateLabel,
  isDateRangeInvalid,
  filtersKey,
  TABLE_COLUMNS,
  type SalaryRecordFilterState,
} from './filters';

type StoredSalaryRecordFilters = {
  draft: SalaryRecordFilterState;
  applied: SalaryRecordFilterState;
  reportingCurrency: string;
  hasApplied: boolean;
};

export default function SalaryRecordsPage() {
  const [searchParams] = useSearchParams();
  const seeded = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const stored = useMemo(
    () => readSessionJson<StoredSalaryRecordFilters>(SESSION_FILTER_KEYS.salaryRecords),
    [],
  );
  const initialFilters = seeded?.filters ?? stored?.applied ?? defaultFilters();
  const [draft, setDraft] = useState<SalaryRecordFilterState>(
    () => seeded?.filters ?? stored?.draft ?? initialFilters,
  );
  const [applied, setApplied] = useState<SalaryRecordFilterState>(() => initialFilters);
  const [reportingCurrency, setReportingCurrency] = useState(
    () => seeded?.reportingCurrency ?? stored?.reportingCurrency ?? 'USD',
  );
  const [hasApplied, setHasApplied] = useState(() => Boolean(seeded) || Boolean(stored?.hasApplied));

  useEffect(() => {
    writeSessionJson(SESSION_FILTER_KEYS.salaryRecords, {
      draft,
      applied,
      reportingCurrency,
      hasApplied,
    } satisfies StoredSalaryRecordFilters);
  }, [draft, applied, reportingCurrency, hasApplied]);

  const rangeInvalid = isDateRangeInvalid(draft.dateFrom, draft.dateTo);
  const filtersDirty = filtersKey(draft) !== filtersKey(applied);
  const apiFilters = useMemo(() => toApiFilters(applied, reportingCurrency), [applied, reportingCurrency]);

  const { data: currencies } = useQuery({ queryKey: [queryKeys.currencies, true], queryFn: () => api.getCurrencies(true) });
  const { data: departments } = useQuery({ queryKey: [queryKeys.departments, true], queryFn: () => api.getDepartments(true) });
  const { data: jobLevels } = useQuery({ queryKey: [queryKeys.jobLevels, true], queryFn: () => api.getJobLevels(true) });

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: [queryKeys.salaryRecords, apiFilters],
    queryFn: () => api.getSalaryRecords(apiFilters),
    enabled: hasApplied,
  });
  const isRefreshing = isFetching && !!data;

  const applyFilters = () => {
    if (rangeInvalid) return;
    setHasApplied(true);
    setApplied({ ...draft, page: 1 });
  };

  const resetDraft = () => setDraft(applied);

  const clearAll = () => {
    const cleared = defaultFilters();
    setDraft(cleared);
    setApplied(cleared);
    setHasApplied(false);
  };

  const handleSort = (sortKey: string) => {
    setApplied((f) => {
      if (f.sortBy === sortKey) {
        return { ...f, sortOrder: f.sortOrder === 'asc' ? 'desc' : 'asc', page: 1 };
      }
      return { ...f, sortBy: sortKey, sortOrder: 'asc', page: 1 };
    });
    setDraft((f) => {
      if (f.sortBy === sortKey) {
        return { ...f, sortOrder: f.sortOrder === 'asc' ? 'desc' : 'asc', page: 1 };
      }
      return { ...f, sortBy: sortKey, sortOrder: 'asc', page: 1 };
    });
  };

  const dateLabel = formatDateLabel(applied.dateFrom, applied.dateTo);

  const emptyMessage = !hasApplied
    ? 'Choose your salary period dates and filters, then click Apply Filters.'
    : `No salary records match these filters for ${dateLabel}`;

  return (
    <div className="page-stack">
      <PageHeader
        title="Salary Records"
        subtitle={
          hasApplied && data
            ? `${data.total.toLocaleString()} records · ${dateLabel}`
            : 'Choose dates and filters, then click Apply Filters'
        }
        meta={<FetchingIndicator show={isRefreshing} />}
      />

      <Card padding>
        <div className="flex items-center gap-2 mb-1">
          <Filter className="w-5 h-5 text-slate-400" />
          <h3 className="section-title">Record Filters</h3>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Pick salary period dates and filters, then click <strong>Apply Filters</strong>.
          Date range matches records whose <strong>period start</strong> falls between From and To
          (not records that merely overlap those days).
          By default only <strong>current period (Active)</strong> records are shown — about one pay
          record per employee. Add <strong>Historical (Inactive)</strong> to include past pay periods.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="filter-panel">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <p className="text-sm font-semibold text-slate-700">Salary period dates</p>
            </div>
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
          </div>

          <div className="filter-panel">
            <p className="text-sm font-semibold text-slate-700">Employee & scope</p>
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
          </div>

          <div className="filter-panel flex flex-col">
            <p className="text-sm font-semibold text-slate-700">Payment & search</p>
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
            <div>
              <label className={labelClass}>Search employee</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="search"
                  className={`${inputClass} pl-9`}
                  placeholder="Name or employee code"
                  value={draft.search}
                  onChange={(e) => setDraft({ ...draft, search: e.target.value })}
                />
              </div>
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
          <p className="text-xs text-amber-600 mt-3">Filters changed — click Apply Filters to update results.</p>
        )}
        {isError && (
          <p className="text-xs text-red-600 mt-3">{error instanceof Error ? error.message : 'Failed to load records'}</p>
        )}

        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
          <span className="text-xs text-slate-500 self-center mr-1">Showing records for:</span>
          <FilterChip label={`Period: ${dateLabel}`} />
          {applied.departmentIds.map((id) => (
            <FilterChip
              key={`dept-${id}`}
              label={`Dept: ${departments?.find((d) => d.id === id)?.name ?? id}`}
            />
          ))}
          {applied.jobLevelIds.map((id) => (
            <FilterChip
              key={`level-${id}`}
              label={`Job Level: ${jobLevels?.find((l) => l.id === id)?.name ?? id}`}
            />
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
              label={`Status: ${status.replace('_', ' ')}`}
            />
          ))}
          {applied.recordStatuses.map((status) => (
            <FilterChip
              key={`rec-${status}`}
              label={`Record: ${status === 'ACTIVE' ? 'Current period' : 'Historical'}`}
            />
          ))}
          {applied.currencyIds.map((id) => (
            <FilterChip
              key={`cur-${id}`}
              label={`Currency: ${currencies?.find((c) => c.id === id)?.code ?? id}`}
            />
          ))}
          {(
            applied.departmentIds.length > 0
            || applied.jobLevelIds.length > 0
            || applied.paymentStatuses.length > 0
            || applied.employmentStatuses.length > 0
            || applied.recordStatuses.length > 0
            || applied.search
            || applied.currencyIds.length > 0
          ) && (
            <button type="button" onClick={clearAll} className="text-xs text-slate-500 hover:text-slate-700 underline ml-auto">
              Reset all
            </button>
          )}
        </div>
      </Card>

      {hasApplied && data?.summary && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="section-title">Filtered Summary</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {data.summary.total_records.toLocaleString()} pay records for{' '}
                {data.summary.employee_count.toLocaleString()} employees · {dateLabel}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:min-w-[200px]">
              <label htmlFor="reporting-currency" className="text-xs text-slate-500 whitespace-nowrap">
                Display in
              </label>
              <select
                id="reporting-currency"
                className={selectClass}
                value={reportingCurrency}
                onChange={(e) => setReportingCurrency(e.target.value)}
              >
                {currencies?.map((c) => (
                  <option key={c.id} value={c.code}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              title="Total Records"
              value={data.summary.total_records.toLocaleString()}
              subtitle={`${data.summary.employee_count.toLocaleString()} employees · ${data.summary.paid_count.toLocaleString()} paid · ${data.summary.not_paid_count.toLocaleString()} unpaid`}
              icon={FileText}
              color="bg-blue-500"
            />
            <MetricCard
              title="Total Paid"
              value={formatCurrency(data.summary.total_paid_amount, '', data.summary.reporting_currency)}
              subtitle={`${data.summary.paid_count.toLocaleString()} record${data.summary.paid_count === 1 ? '' : 's'}`}
              icon={CheckCircle2}
              color="bg-emerald-500"
            />
            <MetricCard
              title="Total Unpaid"
              value={formatCurrency(data.summary.total_not_paid_amount, '', data.summary.reporting_currency)}
              subtitle={`${data.summary.not_paid_count.toLocaleString()} record${data.summary.not_paid_count === 1 ? '' : 's'}`}
              icon={Clock}
              color="bg-amber-500"
            />
          </div>
        </div>
      )}

      {/* Mobile card list */}
      <div className="space-y-3 md:hidden">
        {!hasApplied ? (
          <p className="text-center py-8 text-slate-400 text-sm">{emptyMessage}</p>
        ) : isLoading && !data ? (
          <p className="text-center py-8 text-slate-400 text-sm">Loading salary records...</p>
        ) : data?.items.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">{emptyMessage}</p>
        ) : (
          data?.items.map((record) => (
            <SalaryRecordMobileCard key={record.id} record={record} />
          ))
        )}
      </div>

      {/* Desktop table — matches Employee list UI */}
      <div className="hidden md:block">
        <div className="card overflow-hidden">
          <div className="table-wrap">
            <table className="table" style={{ minWidth: '1100px' }}>
              <thead>
                <tr>
                  {TABLE_COLUMNS.map((col) => (
                    <SortableHeader
                      key={col.label}
                      label={col.label}
                      sortKey={col.sortKey}
                      align={col.align}
                      activeSort={applied.sortBy}
                      sortOrder={applied.sortOrder}
                      onSort={handleSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!hasApplied ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : isLoading && !data ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      Loading salary records...
                    </td>
                  </tr>
                ) : data?.items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  data?.items.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <Link
                          to={`/employees/${record.employee_id}`}
                          className="text-brand-600 hover:text-brand-700 font-mono text-xs font-medium"
                        >
                          {record.employee_code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{record.employee_name}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[200px]">{record.job_title}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{record.department_name}</td>
                      <td className="px-4 py-3 text-slate-600">{record.job_level_name}</td>
                      <td className="px-4 py-3 text-slate-600">{record.country_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant={employmentBadgeVariant(record.employment_status)}>
                          {record.employment_status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-sm whitespace-nowrap">
                        {new Date(record.effective_from).toLocaleDateString()}
                        {record.effective_to && (
                          <> → {new Date(record.effective_to).toLocaleDateString()}</>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={record.payment_status === 'PAID' ? 'success' : 'warning'}>
                          {record.payment_status === 'PAID' ? 'PAID' : 'NOT PAID'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatCurrency(record.adjusted_compensation, record.currency_symbol, record.currency_code)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {data && data.total_pages > 1 && hasApplied && (
        <div className="pagination">
          <span className="text-sm text-slate-600">
            Page {data.page} of {data.total_pages} ({data.total.toLocaleString()} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={applied.page <= 1}
              onClick={() => setApplied((a) => ({ ...a, page: a.page - 1 }))}
              className={`${btnSecondary} btn-sm p-2`}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={applied.page >= data.total_pages}
              onClick={() => setApplied((a) => ({ ...a, page: a.page + 1 }))}
              className={`${btnSecondary} btn-sm p-2`}
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
