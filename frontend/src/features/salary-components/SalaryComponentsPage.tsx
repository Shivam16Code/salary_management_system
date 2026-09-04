import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  api, queryKeys, type SalaryComponent, type SalaryComponentCreatePayload, type SalaryComponentUpdatePayload,
  inputClass, selectClass, labelClass, btnPrimary, btnSecondary, alertErrorClass,
} from '@/shared/api';
import Modal from '@/shared/components/Modal';
import PageHeader from '@/shared/ui/PageHeader';
import DataTable from '@/shared/ui/DataTable';
import Badge from '@/shared/ui/Badge';
import Button from '@/shared/ui/Button';

export default function SalaryComponentsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<SalaryComponentCreatePayload>({
    code: '', name: '', component_type: 'EARNING', calculation_method: 'FIXED', is_taxable: true, is_active: true,
  });
  const [error, setError] = useState('');

  const { data: components, isLoading } = useQuery({
    queryKey: [queryKeys.salaryComponents, false],
    queryFn: () => api.getSalaryComponents(false),
  });

  const createMutation = useMutation({
    mutationFn: api.createSalaryComponent,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [queryKeys.salaryComponents] }); setShowCreate(false); resetForm(); },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SalaryComponentUpdatePayload }) => api.updateSalaryComponent(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [queryKeys.salaryComponents] }); setEditId(null); resetForm(); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteSalaryComponent(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [queryKeys.salaryComponents] }); setError(''); },
    onError: (e: Error) => setError(e.message),
  });

  const resetForm = () => {
    setForm({ code: '', name: '', component_type: 'EARNING', calculation_method: 'FIXED', is_taxable: true, is_active: true });
    setError('');
  };

  const openEdit = (c: SalaryComponent) => {
    setForm({ code: c.code, name: c.name, component_type: c.component_type, calculation_method: c.calculation_method, is_taxable: c.is_taxable, is_active: c.is_active });
    setEditId(c.id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editId) {
      const { code: _, ...updateData } = form;
      updateMutation.mutate({ id: editId, data: updateData });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Salary Components"
        subtitle="Configure earnings and deduction components for employee compensation"
        actions={
          <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}>
            <Plus className="w-4 h-4" /> Add Component
          </Button>
        }
      />

      {error && <p className={alertErrorClass}>{error}</p>}

      <DataTable
        loading={isLoading && !components}
        headers={['Code', 'Name', 'Type', 'Method', 'Taxable', 'Status', 'Actions']}
        emptyMessage="No salary components configured"
        minWidth="800px"
      >
        {components?.map((c) => (
          <tr key={c.id}>
            <td className="font-mono text-xs font-medium">{c.code}</td>
            <td className="font-medium text-slate-900">{c.name}</td>
            <td>
              <Badge variant={c.component_type === 'EARNING' ? 'earning' : 'deduction'}>{c.component_type}</Badge>
            </td>
            <td className="text-slate-600">{c.calculation_method}</td>
            <td className="text-slate-600">{c.is_taxable ? 'Yes' : 'No'}</td>
            <td><Badge variant={c.is_active ? 'success' : 'neutral'}>{c.is_active ? 'Active' : 'Inactive'}</Badge></td>
            <td className="text-right">
              <div className="inline-flex items-center gap-3">
                <button type="button" onClick={() => openEdit(c)} className="text-brand-600 hover:text-brand-700 text-sm font-medium inline-flex items-center gap-1">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete component ${c.code}? Only allowed if unused by salary records.`)) {
                      deleteMutation.mutate(c.id);
                    }
                  }}
                  className="text-red-600 hover:text-red-700 text-sm font-medium inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>

      <Modal title={editId ? 'Edit Component' : 'Add Component'} open={showCreate || editId !== null} onClose={() => { setShowCreate(false); setEditId(null); resetForm(); }}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className={alertErrorClass}>{error}</p>}
          {!editId && (
            <div>
              <label className={labelClass}>Code</label>
              <input required className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. TRAVEL" />
            </div>
          )}
          <div><label className={labelClass}>Name</label><input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelClass}>Type</label><select className={selectClass} value={form.component_type} onChange={(e) => setForm({ ...form, component_type: e.target.value })}><option value="EARNING">Earning</option><option value="DEDUCTION">Deduction</option></select></div>
            <div><label className={labelClass}>Calculation Method</label><select className={selectClass} value={form.calculation_method} onChange={(e) => setForm({ ...form, calculation_method: e.target.value })}><option value="FIXED">Fixed</option><option value="PERCENTAGE">Percentage</option><option value="PER_UNIT">Per Unit</option></select></div>
            <div><label className={labelClass}>Taxable</label><select className={selectClass} value={form.is_taxable ? 'true' : 'false'} onChange={(e) => setForm({ ...form, is_taxable: e.target.value === 'true' })}><option value="true">Yes</option><option value="false">No</option></select></div>
            <div><label className={labelClass}>Active</label><select className={selectClass} value={form.is_active ? 'true' : 'false'} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}><option value="true">Active</option><option value="false">Inactive</option></select></div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={() => { setShowCreate(false); setEditId(null); }} className={btnSecondary}>Cancel</button>
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className={btnPrimary}>{editId ? 'Save Changes' : 'Create Component'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
