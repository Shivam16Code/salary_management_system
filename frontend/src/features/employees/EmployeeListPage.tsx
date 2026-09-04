import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { readSessionJson, writeSessionJson, SESSION_FILTER_KEYS } from '@/shared/lib/sessionState';
import {
  Search, ChevronLeft, ChevronRight, Filter, Plus,
} from 'lucide-react';
import {
  api, formatCurrency, queryKeys,
  type EmployeeCreatePayload,
  type EmployeeDetail,
  type EmployeeSalaryProfileCreatePayload,
  inputClass, selectClass, labelClass, btnPrimary, btnSecondary,
  alertErrorClass, alertInfoClass,
} from '@/shared/api';
import Modal from '@/shared/components/Modal';
import PageHeader from '@/shared/ui/PageHeader';
import Badge, { employmentBadgeVariant } from '@/shared/ui/Badge';
import Button from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import MultiSelect from '@/shared/ui/MultiSelect';
import FilterChip from '@/shared/ui/FilterChip';
import SortableHeader from '@/shared/ui/SortableHeader';
import { FetchingIndicator } from '@/shared/ui/Spinner';
import { EMPLOYMENT_STATUS_OPTIONS } from '@/shared/constants/filterOptions';
import EmployeeMobileCard from './components/EmployeeMobileCard';
import {
  emptyForm, SORT_OPTIONS, PAGE_SIZE_OPTIONS, TABLE_COLUMNS,
  defaultFilters, filtersFromSearchParams, toApiFilters, filtersKey,
  type EmployeeFilterState,
} from './filters';

const emptyProfileForm = (): EmployeeSalaryProfileCreatePayload => ({
  package_amount: 0,
  pay_frequency: 'MONTHLY',
  effective_from: new Date().toISOString().slice(0, 10),
  change_reason: '',
});

type StoredEmployeeFilters = {
  draft: EmployeeFilterState;
  applied: EmployeeFilterState;
  hasApplied: boolean;
};

export default function EmployeeListPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const seeded = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const stored = useMemo(
    () => readSessionJson<StoredEmployeeFilters>(SESSION_FILTER_KEYS.employees),
    [],
  );
  const initial = seeded ?? stored?.applied ?? defaultFilters();
  const [draft, setDraft] = useState<EmployeeFilterState>(() => seeded ?? stored?.draft ?? initial);
  const [applied, setApplied] = useState<EmployeeFilterState>(() => initial);
  const [hasApplied, setHasApplied] = useState(() => Boolean(seeded) || stored?.hasApplied !== false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    writeSessionJson(SESSION_FILTER_KEYS.employees, {
      draft,
      applied,
      hasApplied,
    } satisfies StoredEmployeeFilters);
  }, [draft, applied, hasApplied]);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [createdEmployee, setCreatedEmployee] = useState<EmployeeDetail | null>(null);
  const [form, setForm] = useState<EmployeeCreatePayload>(emptyForm);
  const [formError, setFormError] = useState('');
  const [profileForm, setProfileForm] = useState<EmployeeSalaryProfileCreatePayload>(emptyProfileForm);
  const [profileError, setProfileError] = useState('');

  const filtersDirty = filtersKey(draft) !== filtersKey(applied);
  const apiFilters = useMemo(() => toApiFilters(applied), [applied]);

  const { data: countries } = useQuery({ queryKey: [queryKeys.countries, true], queryFn: () => api.getCountries(true) });
  const { data: departments } = useQuery({ queryKey: [queryKeys.departments, true], queryFn: () => api.getDepartments(true) });
  const { data: jobLevels } = useQuery({ queryKey: [queryKeys.jobLevels, true], queryFn: () => api.getJobLevels(true) });
  const { data: currencies } = useQuery({ queryKey: [queryKeys.currencies, true], queryFn: () => api.getCurrencies(true) });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [queryKeys.employees, apiFilters],
    queryFn: () => api.getEmployees(apiFilters),
    enabled: hasApplied,
  });
  const isRefreshing = isFetching && !!data;

  const { data: profilePreview } = useQuery({
    queryKey: [queryKeys.salaryProfilePreview, profileForm.package_amount, profileForm.pay_frequency],
    queryFn: () => api.previewSalaryProfile({
      package_amount: profileForm.package_amount,
      pay_frequency: profileForm.pay_frequency,
      effective_from: profileForm.effective_from,
    }),
    enabled: showCreate && createStep === 2 && profileForm.package_amount > 0,
  });

  const resetCreateFlow = () => {
    setShowCreate(false);
    setCreateStep(1);
    setCreatedEmployee(null);
    setForm(emptyForm);
    setFormError('');
    setProfileForm(emptyProfileForm());
    setProfileError('');
  };

  const openCreateFlow = () => {
    setCreateStep(1);
    setCreatedEmployee(null);
    setForm(emptyForm);
    setFormError('');
    setProfileForm(emptyProfileForm());
    setProfileError('');
    setShowCreate(true);
  };

  const finishAndOpenEmployee = (employeeId: number) => {
    queryClient.invalidateQueries({ queryKey: [queryKeys.employees] });
    resetCreateFlow();
    navigate(`/employees/${employeeId}`);
  };

  const createMutation = useMutation({
    mutationFn: api.createEmployee,
    onSuccess: (employee) => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.employees] });
      setCreatedEmployee(employee);
      setFormError('');
      setProfileForm({
        package_amount: 0,
        pay_frequency: 'MONTHLY',
        effective_from: employee.hire_date || new Date().toISOString().slice(0, 10),
        change_reason: '',
      });
      setProfileError('');
      setCreateStep(2);
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const createProfileMutation = useMutation({
    mutationFn: (data: EmployeeSalaryProfileCreatePayload) => {
      if (!createdEmployee) throw new Error('Employee was not created');
      return api.createSalaryProfile(createdEmployee.id, data);
    },
    onSuccess: () => {
      if (createdEmployee) finishAndOpenEmployee(createdEmployee.id);
    },
    onError: (e: Error) => setProfileError(e.message),
  });

  const applyFilters = () => {
    setHasApplied(true);
    setApplied({ ...draft, page: 1 });
  };

  const resetDraft = () => setDraft(applied);

  const clearAll = () => {
    const cleared = defaultFilters();
    setDraft(cleared);
    setApplied(cleared);
    setHasApplied(true);
  };

  const handleSort = (sortKey: string) => {
    const update = (f: EmployeeFilterState): EmployeeFilterState => {
      if (f.sortBy === sortKey) {
        return { ...f, sortOrder: f.sortOrder === 'asc' ? 'desc' : 'asc', page: 1 };
      }
      return { ...f, sortBy: sortKey, sortOrder: 'asc', page: 1 };
    };
    setApplied(update);
    setDraft(update);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (profileForm.package_amount <= 0) {
      setProfileError('Package amount must be greater than zero.');
      return;
    }
    createProfileMutation.mutate(profileForm);
  };

  const sortLabel = SORT_OPTIONS.find((o) => o.value === applied.sortBy)?.label ?? 'Employee Code';
  const currencySymbol = createdEmployee?.country_currency_symbol ?? '';

  return (
    <div className="page-stack">
      <PageHeader
        title="Employees"
        subtitle={
          hasApplied && data
            ? `${data.total.toLocaleString()} employees · Sorted by ${sortLabel}`
            : 'Set filters and click Apply Filters'
        }
        meta={<FetchingIndicator show={isRefreshing} />}
        actions={
          <Button size="sm" onClick={openCreateFlow}>
            <Plus className="w-4 h-4" /> Add Employee
          </Button>
        }
      />

      <Card padding>
        <div className="flex items-center gap-2 mb-1">
          <Filter className="w-5 h-5 text-slate-400" />
          <h3 className="section-title">Employee Filters</h3>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Pick filters — dropdowns support multiple selections — then click <strong>Apply Filters</strong>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="filter-panel">
            <p className="text-sm font-semibold text-slate-700">Sort & display</p>
            <div>
              <label className={labelClass}>Sort by</label>
              <select
                className={selectClass}
                value={draft.sortBy}
                onChange={(e) => setDraft({ ...draft, sortBy: e.target.value })}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Sort order</label>
              <select
                className={selectClass}
                value={draft.sortOrder}
                onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value as 'asc' | 'desc' })}
              >
                <option value="asc">Ascending (A→Z)</option>
                <option value="desc">Descending (Z→A)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Rows per page</label>
              <select
                className={selectClass}
                value={draft.pageSize}
                onChange={(e) => setDraft({ ...draft, pageSize: Number(e.target.value) })}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
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
          </div>

          <div className="filter-panel flex flex-col">
            <p className="text-sm font-semibold text-slate-700">Compensation & search</p>
            <MultiSelect
              label="Currency"
              placeholder="All currencies"
              options={currencies?.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })) ?? []}
              value={draft.currencyIds}
              onChange={(currencyIds) => setDraft({ ...draft, currencyIds })}
            />
            <div>
              <label className={labelClass}>Min annual package</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                placeholder="Min amount"
                value={draft.salaryMin}
                onChange={(e) => setDraft({ ...draft, salaryMin: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Max annual package</label>
              <input
                type="number"
                min={0}
                className={inputClass}
                placeholder="Max amount"
                value={draft.salaryMax}
                onChange={(e) => setDraft({ ...draft, salaryMax: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Search employee</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="search"
                  className={`${inputClass} pl-9`}
                  placeholder="Name, code, email, or job title"
                  value={draft.search}
                  onChange={(e) => setDraft({ ...draft, search: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-auto pt-2">
              <Button
                type="button"
                onClick={applyFilters}
                disabled={isFetching || (hasApplied && !filtersDirty)}
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

        {filtersDirty && (
          <p className="text-xs text-amber-600 mt-3">Filters changed — click Apply Filters to update results.</p>
        )}

        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
          <span className="text-xs text-slate-500 self-center mr-1">Showing employees for:</span>
          {applied.departmentIds.map((id) => (
            <FilterChip key={`dept-${id}`} label={`Dept: ${departments?.find((d) => d.id === id)?.name ?? id}`} />
          ))}
          {applied.jobLevelIds.map((id) => (
            <FilterChip key={`level-${id}`} label={`Job Level: ${jobLevels?.find((l) => l.id === id)?.name ?? id}`} />
          ))}
          {applied.employmentStatuses.map((status) => (
            <FilterChip key={`emp-${status}`} label={`Status: ${status.replace('_', ' ')}`} />
          ))}
          {applied.currencyIds.map((id) => (
            <FilterChip key={`cur-${id}`} label={`Currency: ${currencies?.find((c) => c.id === id)?.code ?? id}`} />
          ))}
          {applied.salaryMin ? <FilterChip label={`Min: ${applied.salaryMin}`} /> : null}
          {applied.salaryMax ? <FilterChip label={`Max: ${applied.salaryMax}`} /> : null}
          {applied.search ? <FilterChip label={`Search: ${applied.search}`} /> : null}
          {(
            applied.departmentIds.length > 0
            || applied.jobLevelIds.length > 0
            || applied.employmentStatuses.length > 0
            || applied.currencyIds.length > 0
            || applied.salaryMin
            || applied.salaryMax
            || applied.search
          ) && (
            <button type="button" onClick={clearAll} className="text-xs text-slate-500 hover:text-slate-700 underline ml-auto">
              Reset all
            </button>
          )}
        </div>
      </Card>

      <div className="space-y-3 md:hidden">
        {isLoading && !data ? (
          <p className="text-center py-8 text-slate-400 text-sm">Loading employees...</p>
        ) : !hasApplied ? (
          <p className="text-center py-8 text-slate-400 text-sm">Set filters and click Apply Filters.</p>
        ) : data?.items.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">No employees found</p>
        ) : (
          data?.items.map((employee) => <EmployeeMobileCard key={employee.id} employee={employee} />)
        )}
      </div>

      <div className="hidden md:block">
        <div className="card overflow-hidden">
          <div className="table-wrap">
            <table className="table" style={{ minWidth: '900px' }}>
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
                {isLoading && !data ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400">Loading employees...</td></tr>
                ) : !hasApplied ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400">Set filters and click Apply Filters.</td></tr>
                ) : data?.items.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400">No employees found</td></tr>
                ) : (
                  data?.items.map((employee) => (
                    <tr key={employee.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <Link to={`/employees/${employee.id}`} className="text-brand-600 hover:text-brand-700 font-mono text-xs font-medium">
                          {employee.employee_code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{employee.full_name}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[200px]">{employee.job_title}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{employee.department_name}</td>
                      <td className="px-4 py-3 text-slate-600">{employee.job_level_name}</td>
                      <td className="px-4 py-3 text-slate-600">{employee.country_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant={employmentBadgeVariant(employee.employment_status)}>{employee.employment_status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatCurrency(employee.annual_package, employee.currency_symbol ?? '', employee.currency_code ?? '')}
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
              onClick={() => {
                const page = applied.page - 1;
                setApplied((a) => ({ ...a, page }));
                setDraft((d) => ({ ...d, page }));
              }}
              className={`${btnSecondary} btn-sm p-2`}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={applied.page >= data.total_pages}
              onClick={() => {
                const page = applied.page + 1;
                setApplied((a) => ({ ...a, page }));
                setDraft((d) => ({ ...d, page }));
              }}
              className={`${btnSecondary} btn-sm p-2`}
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <Modal
        title={createStep === 1 ? 'Add Employee' : `Salary package — ${createdEmployee?.full_name ?? 'Employee'}`}
        open={showCreate}
        onClose={() => {
          if (createStep === 2 && createdEmployee) {
            finishAndOpenEmployee(createdEmployee.id);
            return;
          }
          resetCreateFlow();
        }}
        wide
      >
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <span className={createStep === 1 ? 'font-semibold text-brand-700' : 'text-emerald-600'}>
            1. Employee details
          </span>
          <span aria-hidden>→</span>
          <span className={createStep === 2 ? 'font-semibold text-brand-700' : ''}>
            2. Salary package
          </span>
        </div>

        {createStep === 1 ? (
          <form onSubmit={handleCreate} className="space-y-4">
            {formError && <p className={alertErrorClass}>{formError}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelClass}>First Name</label><input required className={inputClass} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
              <div><label className={labelClass}>Last Name</label><input required className={inputClass} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className={labelClass}>Email</label><input required type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className={labelClass}>Country</label><select required className={selectClass} value={form.country_id || ''} onChange={(e) => setForm({ ...form, country_id: Number(e.target.value) })}><option value="">Select</option>{countries?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.currency_code})</option>)}</select></div>
              <div><label className={labelClass}>Department</label><select required className={selectClass} value={form.department_id || ''} onChange={(e) => setForm({ ...form, department_id: Number(e.target.value) })}><option value="">Select</option>{departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label className={labelClass}>Job Level</label><select required className={selectClass} value={form.job_level_id || ''} onChange={(e) => setForm({ ...form, job_level_id: Number(e.target.value) })}><option value="">Select</option>{jobLevels?.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}</select></div>
              <div><label className={labelClass}>Job Title</label><input required className={inputClass} value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></div>
              <div><label className={labelClass}>Hire Date</label><input required type="date" className={inputClass} value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
              <div><label className={labelClass}>Status</label><select className={selectClass} value={form.employment_status ?? 'ACTIVE'} onChange={(e) => setForm({ ...form, employment_status: e.target.value })}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ON_LEAVE">On Leave</option></select></div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <button type="button" onClick={resetCreateFlow} className={btnSecondary}>Cancel</button>
              <button type="submit" disabled={createMutation.isPending} className={btnPrimary}>
                {createMutation.isPending ? 'Creating...' : 'Create & set package'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreateProfile} className="space-y-4">
            {profileError && <p className={alertErrorClass}>{profileError}</p>}
            <p className={alertInfoClass}>
              {createdEmployee
                ? `${createdEmployee.full_name} (${createdEmployee.employee_code}) was created. Set their compensation package next — no need to search for them.`
                : 'Set the compensation package for this employee.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Package Amount ({currencySymbol})</label>
                <input
                  required
                  type="number"
                  min={1}
                  className={inputClass}
                  value={profileForm.package_amount || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, package_amount: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className={labelClass}>Pay Frequency</label>
                <select
                  className={selectClass}
                  value={profileForm.pay_frequency}
                  onChange={(e) => setProfileForm({
                    ...profileForm,
                    pay_frequency: e.target.value as EmployeeSalaryProfileCreatePayload['pay_frequency'],
                  })}
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Effective From</label>
                <input
                  required
                  type="date"
                  className={inputClass}
                  value={profileForm.effective_from}
                  onChange={(e) => setProfileForm({ ...profileForm, effective_from: e.target.value })}
                />
              </div>
            </div>
            {profilePreview && profileForm.package_amount > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-brand-50/50 border border-brand-100">
                <div>
                  <p className="text-xs text-slate-500">Annual Package</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(profilePreview.annual_package, currencySymbol)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Monthly Base (BASIC)</p>
                  <p className="font-semibold tabular-nums text-brand-700">{formatCurrency(profilePreview.base_salary, currencySymbol)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Per {profileForm.pay_frequency.toLowerCase()} period</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(profilePreview.per_period_amount, currencySymbol)}</p>
                </div>
              </div>
            )}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <button
                type="button"
                className={btnSecondary}
                disabled={!createdEmployee || createProfileMutation.isPending}
                onClick={() => createdEmployee && finishAndOpenEmployee(createdEmployee.id)}
              >
                Skip for now
              </button>
              <button type="submit" disabled={createProfileMutation.isPending} className={btnPrimary}>
                {createProfileMutation.isPending ? 'Saving...' : 'Save package'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
