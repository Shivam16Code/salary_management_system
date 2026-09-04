import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail, MapPin, Briefcase, Calendar, Pencil, Plus, Wallet, Trash2 } from 'lucide-react';
import {
  api, formatCurrency, queryKeys, type EmployeeUpdatePayload, type SalaryRecord, type SalaryRecordCreatePayload,
  type SalaryRecordUpdatePayload, type EmployeeSalaryProfileCreatePayload,
  inputClass, selectClass, labelClass, btnPrimary, btnSecondary,
  alertErrorClass, alertInfoClass,
} from '@/shared/api';
import Modal from '@/shared/components/Modal';
import {
  SalaryRecordForm,
  buildDefaultLines,
  linesFromRecord,
  linesToPayload,
  type ComponentLine,
} from '@/features/salary-records';
import Badge, { employmentBadgeVariant } from '@/shared/ui/Badge';
import Button from '@/shared/ui/Button';
import { Card, CardHeader } from '@/shared/ui/Card';
import { PageLoader, FetchingIndicator } from '@/shared/ui/Spinner';
import EmptyState from '@/shared/ui/EmptyState';
import { ProfileStat, SalaryComponentCard, InfoItem } from './components/EmployeeDetailBits';

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const employeeId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showEdit, setShowEdit] = useState(false);
  const [showAddSalary, setShowAddSalary] = useState(false);
  const [editRecord, setEditRecord] = useState<SalaryRecord | null>(null);
  const [editForm, setEditForm] = useState<EmployeeUpdatePayload>({});
  const [salaryForm, setSalaryForm] = useState({
    effective_from: new Date().toISOString().slice(0, 10),
    effective_to: '',
    payment_status: 'NOT_PAID',
  });
  const [componentLines, setComponentLines] = useState<ComponentLine[]>([]);
  const [error, setError] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState<EmployeeSalaryProfileCreatePayload>({
    package_amount: 0,
    pay_frequency: 'MONTHLY',
    effective_from: new Date().toISOString().slice(0, 10),
    change_reason: '',
  });
  const [profileError, setProfileError] = useState('');

  const { data: employee, isLoading, isFetching } = useQuery({
    queryKey: [queryKeys.employee, employeeId],
    queryFn: () => api.getEmployee(employeeId),
    enabled: !!employeeId,
  });

  const { data: countries } = useQuery({ queryKey: [queryKeys.countries, true], queryFn: () => api.getCountries(true) });
  const { data: departments } = useQuery({ queryKey: [queryKeys.departments, true], queryFn: () => api.getDepartments(true) });
  const { data: jobLevels } = useQuery({ queryKey: [queryKeys.jobLevels, true], queryFn: () => api.getJobLevels(true) });
  const { data: components } = useQuery({ queryKey: [queryKeys.salaryComponents, true], queryFn: () => api.getSalaryComponents() });

  const { data: profileHistory } = useQuery({
    queryKey: [queryKeys.salaryProfileHistory, employeeId],
    queryFn: () => api.getSalaryProfileHistory(employeeId),
    enabled: !!employeeId && !!employee?.salary_profile,
  });

  const { data: profilePreview } = useQuery({
    queryKey: [queryKeys.salaryProfilePreview, profileForm.package_amount, profileForm.pay_frequency],
    queryFn: () => api.previewSalaryProfile({
      package_amount: profileForm.package_amount,
      pay_frequency: profileForm.pay_frequency,
      effective_from: profileForm.effective_from,
    }),
    enabled: showProfileModal && profileForm.package_amount > 0,
  });

  const createProfileMutation = useMutation({
    mutationFn: (data: EmployeeSalaryProfileCreatePayload) => api.createSalaryProfile(employeeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.employee, employeeId] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.salaryProfileHistory, employeeId] });
      setShowProfileModal(false);
      setProfileError('');
    },
    onError: (e: Error) => setProfileError(e.message),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: EmployeeSalaryProfileCreatePayload) => api.updateSalaryProfile(employeeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.employee, employeeId] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.salaryProfileHistory, employeeId] });
      setShowProfileModal(false);
      setProfileError('');
    },
    onError: (e: Error) => setProfileError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: EmployeeUpdatePayload) => api.updateEmployee(employeeId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [queryKeys.employee, employeeId] }); setShowEdit(false); setError(''); },
    onError: (e: Error) => setError(e.message),
  });

  const createSalaryMutation = useMutation({
    mutationFn: (data: SalaryRecordCreatePayload) => api.createSalary(employeeId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [queryKeys.employee, employeeId] }); closeSalaryModal(); },
    onError: (e: Error) => setError(e.message),
  });

  const updateSalaryMutation = useMutation({
    mutationFn: ({ recordId, data }: { recordId: number; data: SalaryRecordUpdatePayload }) =>
      api.updateSalary(recordId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [queryKeys.employee, employeeId] }); closeSalaryModal(); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: () => api.deleteEmployee(employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.employees] });
      navigate('/employees');
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteSalaryMutation = useMutation({
    mutationFn: (recordId: number) => api.deleteSalary(recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.employee, employeeId] });
      setError('');
    },
    onError: (e: Error) => setError(e.message),
  });

  const closeSalaryModal = () => {
    setShowAddSalary(false);
    setEditRecord(null);
    setError('');
  };

  const openEdit = () => {
    if (!employee) return;
    const country = countries?.find((c) => c.iso_code === employee.country_code);
    const dept = departments?.find((d) => d.code === employee.department_code);
    const level = jobLevels?.find((l) => l.code === employee.job_level_code);
    setEditForm({
      first_name: employee.first_name, last_name: employee.last_name, email: employee.email,
      country_id: country?.id, department_id: dept?.id, job_level_id: level?.id,
      job_title: employee.job_title, employment_status: employee.employment_status,
    });
    setShowEdit(true);
  };

  const openAddSalary = () => {
    if (!components?.length) { setError('No salary components configured'); return; }
    if (!employee?.salary_profile) {
      setError('Create a salary profile with base salary before adding payroll records.');
      openProfileModal();
      return;
    }
    setSalaryForm({
      effective_from: new Date().toISOString().slice(0, 10),
      effective_to: '',
      payment_status: 'NOT_PAID',
    });
    setComponentLines(buildDefaultLines(components, employee.salary_profile));
    setError('');
    setShowAddSalary(true);
  };

  const basicComponentId = components?.find((c) => c.code === 'BASIC')?.id;

  const openProfileModal = () => {
    const profile = employee?.salary_profile;
    setProfileForm({
      package_amount: profile ? Number(profile.package_amount) : 0,
      pay_frequency: profile?.pay_frequency ?? 'MONTHLY',
      effective_from: new Date().toISOString().slice(0, 10),
      change_reason: '',
    });
    setProfileError('');
    setShowProfileModal(true);
  };

  const submitProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (profileForm.package_amount <= 0) {
      setProfileError('Package amount must be greater than zero');
      return;
    }
    if (employee?.salary_profile) {
      updateProfileMutation.mutate(profileForm);
    } else {
      createProfileMutation.mutate(profileForm);
    }
  };

  const openEditSalary = (record: SalaryRecord) => {
    setEditRecord(record);
    setSalaryForm({
      effective_from: record.effective_from,
      effective_to: record.effective_to ?? '',
      payment_status: record.payment_status ?? 'NOT_PAID',
    });
    setComponentLines(linesFromRecord(record, basicComponentId));
    setError('');
  };

  const submitSalary = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = linesToPayload(componentLines);
    const hasAutoBasic = !!employee?.salary_profile;
    if (payload.length === 0 && !hasAutoBasic) {
      setError('Add at least one salary component');
      return;
    }

    if (editRecord) {
      updateSalaryMutation.mutate({
        recordId: editRecord.id,
        data: {
          effective_to: salaryForm.effective_to || undefined,
          payment_status: salaryForm.payment_status,
          components: payload,
        },
      });
    } else {
      createSalaryMutation.mutate({
        effective_from: salaryForm.effective_from,
        effective_to: salaryForm.effective_to || undefined,
        payment_status: salaryForm.payment_status,
        components: payload,
      });
    }
  };

  if (isLoading && !employee) return <PageLoader />;
  if (!employee) {
    return (
      <EmptyState
        title="Employee not found"
        description="The employee you're looking for doesn't exist or was removed."
      />
    );
  }

  const salaryModalOpen = showAddSalary || editRecord !== null;
  const salaryPending = createSalaryMutation.isPending || updateSalaryMutation.isPending;
  const currencyDisplay = formatCurrency(
    employee.current_salary,
    employee.country_currency_symbol ?? employee.currency_symbol ?? '',
    employee.country_currency_code ?? employee.currency_code ?? '',
  );

  return (
    <div className="page-stack">
      <Link to="/employees" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to Employees
      </Link>

      <Card padding>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="page-title">{employee.full_name}</h1>
              <Badge variant={employmentBadgeVariant(employee.employment_status)}>{employee.employment_status}</Badge>
              <FetchingIndicator show={isFetching && !isLoading} />
            </div>
            <p className="text-slate-500 mt-1 font-mono text-sm">{employee.employee_code}</p>
            <p className="mt-3 text-sm text-slate-600">{employee.job_title}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-center sm:text-right">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Current Compensation</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5 tabular-nums">{currencyDisplay}</p>
            </div>
            <Button variant="secondary" onClick={openEdit}>
              <Pencil className="w-4 h-4" /> Edit
            </Button>
            <Button
              variant="danger"
              disabled={deleteEmployeeMutation.isPending}
              onClick={() => {
                if (window.confirm(`Delete ${employee.full_name}? This removes all salary records and profiles for this employee.`)) {
                  deleteEmployeeMutation.mutate();
                }
              }}
            >
              <Trash2 className="w-4 h-4" /> Delete
            </Button>
          </div>
        </div>

        {error && <p className={`${alertErrorClass} mt-4`}>{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <InfoItem icon={Mail} label="Email" value={employee.email} />
          <InfoItem icon={MapPin} label="Country" value={`${employee.country_name} (${employee.country_currency_code})`} />
          <InfoItem icon={Briefcase} label="Department" value={`${employee.department_name} · ${employee.job_level_name}`} />
          <InfoItem icon={Calendar} label="Hire Date" value={new Date(employee.hire_date).toLocaleDateString()} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Salary Profile"
          subtitle="Base salary package — used automatically for payroll records"
          actions={
            <Button size="sm" variant={employee.salary_profile ? 'secondary' : 'primary'} onClick={openProfileModal}>
              <Wallet className="w-4 h-4" />
              {employee.salary_profile ? 'Update Package' : 'Set Up Profile'}
            </Button>
          }
        />
        {!employee.salary_profile ? (
          <div className="p-4 sm:p-6">
            <EmptyState
              title="No salary profile"
              description="Define the employee's compensation package (weekly, monthly, quarterly, or yearly). Base salary will auto-fill when creating payroll records."
            />
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ProfileStat label="Package" value={formatCurrency(employee.salary_profile.package_amount, employee.salary_profile.currency_symbol)} sub={`Per ${employee.salary_profile.pay_frequency.toLowerCase()}`} />
              <ProfileStat label="Annual Package" value={formatCurrency(employee.salary_profile.annual_package, employee.salary_profile.currency_symbol)} />
              <ProfileStat label="Monthly Base" value={formatCurrency(employee.salary_profile.base_salary, employee.salary_profile.currency_symbol)} sub="Auto-used for BASIC" highlight />
              <ProfileStat label="Effective From" value={new Date(employee.salary_profile.effective_from).toLocaleDateString()} />
            </div>
            {profileHistory && profileHistory.length > 1 && (
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Package History</h4>
                <div className="space-y-2">
                  {profileHistory.slice(1).map((h) => (
                    <div key={h.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div>
                        <span className="font-medium">{formatCurrency(h.annual_package, h.currency_symbol)} / year</span>
                        <span className="text-slate-400 ml-2">({h.pay_frequency.toLowerCase()} {formatCurrency(h.package_amount, h.currency_symbol)})</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(h.effective_from).toLocaleDateString()}
                        {h.effective_to && ` → ${new Date(h.effective_to).toLocaleDateString()}`}
                        {h.change_reason && ` · ${h.change_reason}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Salary History"
          subtitle={`${employee.salary_records.length} record(s)`}
          actions={
            <Button size="sm" onClick={openAddSalary} disabled={!employee.salary_profile}>
              <Plus className="w-4 h-4" /> Add Record
            </Button>
          }
        />
        <div className="divide-y divide-slate-100">
          {employee.salary_records.length === 0 ? (
            <EmptyState title="No salary records" description="Add a salary record to define compensation components." />
          ) : (
            employee.salary_records.map((record) => (
              <div key={record.id} className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={record.payment_status === 'PAID' ? 'success' : 'warning'}>
                        {record.payment_status === 'PAID' ? 'Paid' : 'Not paid'}
                      </Badge>
                      <span className="text-sm text-slate-600">
                        {new Date(record.effective_from).toLocaleDateString()}
                        {record.effective_to && ` → ${new Date(record.effective_to).toLocaleDateString()}`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{record.components.length} component(s)</p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="text-left sm:text-right">
                      <p className="font-bold text-slate-900 tabular-nums">
                        {formatCurrency(record.adjusted_compensation, record.currency_symbol, record.currency_code)}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Earnings: {formatCurrency(record.total_earnings, record.currency_symbol)} ·
                        Deductions: {formatCurrency(record.total_deductions, record.currency_symbol)}
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => openEditSalary(record)}>
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deleteSalaryMutation.isPending}
                      onClick={() => {
                        if (window.confirm('Delete this salary record and its components?')) {
                          deleteSalaryMutation.mutate(record.id);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {record.components.map((component) => (
                    <SalaryComponentCard key={component.id} component={component} symbol={record.currency_symbol} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal title="Edit Employee" open={showEdit} onClose={() => setShowEdit(false)} wide>
        <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(editForm); }} className="space-y-4">
          {error && !salaryModalOpen && <p className={alertErrorClass}>{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>First Name</label><input className={inputClass} value={editForm.first_name ?? ''} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} /></div>
            <div><label className={labelClass}>Last Name</label><input className={inputClass} value={editForm.last_name ?? ''} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className={labelClass}>Email</label><input type="email" className={inputClass} value={editForm.email ?? ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
            <div><label className={labelClass}>Country</label><select className={selectClass} value={editForm.country_id ?? ''} onChange={(e) => setEditForm({ ...editForm, country_id: Number(e.target.value) })}><option value="">Select</option>{countries?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.currency_code})</option>)}</select></div>
            <div><label className={labelClass}>Department</label><select className={selectClass} value={editForm.department_id ?? ''} onChange={(e) => setEditForm({ ...editForm, department_id: Number(e.target.value) })}><option value="">Select</option>{departments?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className={labelClass}>Job Level</label><select className={selectClass} value={editForm.job_level_id ?? ''} onChange={(e) => setEditForm({ ...editForm, job_level_id: Number(e.target.value) })}><option value="">Select</option>{jobLevels?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
            <div><label className={labelClass}>Job Title</label><input className={inputClass} value={editForm.job_title ?? ''} onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })} /></div>
            <div><label className={labelClass}>Status</label><select className={selectClass} value={editForm.employment_status ?? 'ACTIVE'} onChange={(e) => setEditForm({ ...editForm, employment_status: e.target.value })}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="TERMINATED">Terminated</option><option value="ON_LEAVE">On Leave</option></select></div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={() => setShowEdit(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={updateMutation.isPending} className={btnPrimary}>Save Changes</button>
          </div>
        </form>
      </Modal>

      <Modal title={editRecord ? 'Edit Salary Record' : 'Add Salary Record'} open={salaryModalOpen} onClose={closeSalaryModal} wide>
        <form onSubmit={submitSalary} className="space-y-4">
          {error && <p className={alertErrorClass}>{error}</p>}
          <p className={alertInfoClass}>
            Currency: <span className="font-semibold text-slate-800">{employee.country_currency_code}</span>
            {' '}({employee.country_currency_symbol}) — from employee country
          </p>
          {employee.salary_profile && (
            <p className={alertInfoClass}>
              Basic salary ({formatCurrency(employee.salary_profile.base_salary, employee.salary_profile.currency_symbol)}) is applied automatically from the salary profile.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!editRecord && (
              <div>
                <label className={labelClass}>Effective From</label>
                <input required type="date" className={inputClass} value={salaryForm.effective_from} onChange={(e) => setSalaryForm({ ...salaryForm, effective_from: e.target.value })} />
              </div>
            )}
            <div>
              <label className={labelClass}>Effective To</label>
              <input type="date" className={inputClass} value={salaryForm.effective_to} onChange={(e) => setSalaryForm({ ...salaryForm, effective_to: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Payment status</label>
              <select className={selectClass} value={salaryForm.payment_status} onChange={(e) => setSalaryForm({ ...salaryForm, payment_status: e.target.value })}>
                <option value="PAID">Paid</option>
                <option value="NOT_PAID">Not paid</option>
              </select>
            </div>
          </div>

          {components && (
            <SalaryRecordForm
              components={components}
              lines={componentLines}
              onChange={setComponentLines}
              currencySymbol={employee.country_currency_symbol ?? ''}
              autoBasicFromProfile={!!employee.salary_profile}
            />
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={closeSalaryModal} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={salaryPending} className={btnPrimary}>
              {editRecord ? 'Save Changes' : 'Create Record'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title={employee.salary_profile ? 'Update Salary Package' : 'Create Salary Profile'}
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        wide
      >
        <form onSubmit={submitProfile} className="space-y-4">
          {profileError && <p className={alertErrorClass}>{profileError}</p>}
          <p className={alertInfoClass}>
            Enter the compensation package in your chosen frequency. Monthly base salary (for BASIC) is calculated automatically.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Package Amount ({employee.country_currency_symbol})</label>
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
                onChange={(e) => setProfileForm({ ...profileForm, pay_frequency: e.target.value as EmployeeSalaryProfileCreatePayload['pay_frequency'] })}
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
            {employee.salary_profile && (
              <div>
                <label className={labelClass}>Reason for Change</label>
                <input
                  className={inputClass}
                  placeholder="e.g. Annual increment, promotion"
                  value={profileForm.change_reason ?? ''}
                  onChange={(e) => setProfileForm({ ...profileForm, change_reason: e.target.value })}
                />
              </div>
            )}
          </div>
          {profilePreview && profileForm.package_amount > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-brand-50/50 border border-brand-100">
              <div>
                <p className="text-xs text-slate-500">Annual Package</p>
                <p className="font-semibold tabular-nums">{formatCurrency(profilePreview.annual_package, employee.country_currency_symbol)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Monthly Base (BASIC)</p>
                <p className="font-semibold tabular-nums text-brand-700">{formatCurrency(profilePreview.base_salary, employee.country_currency_symbol)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Per {profileForm.pay_frequency.toLowerCase()} period</p>
                <p className="font-semibold tabular-nums">{formatCurrency(profilePreview.per_period_amount, employee.country_currency_symbol)}</p>
              </div>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={() => setShowProfileModal(false)} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={createProfileMutation.isPending || updateProfileMutation.isPending} className={btnPrimary}>
              {employee.salary_profile ? 'Save New Package' : 'Create Profile'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
