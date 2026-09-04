import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  api,
  queryKeys,
  type Department,
  type DepartmentCreatePayload,
  type DepartmentUpdatePayload,
  inputClass,
  selectClass,
  labelClass,
  alertErrorClass,
} from '@/shared/api';
import Modal from '@/shared/components/Modal';
import DataTable from '@/shared/ui/DataTable';
import Button from '@/shared/ui/Button';
import { ModalActions, StatusBadge, TabHeader } from './MasterDataBits';

export default function DepartmentsTab() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState<DepartmentCreatePayload>({ code: '', name: '', is_active: true });

  const { data: departments, isLoading } = useQuery({ queryKey: [queryKeys.departments, false], queryFn: () => api.getDepartments(false) });

  const createMutation = useMutation({
    mutationFn: api.createDepartment,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [queryKeys.departments] }); setShowCreate(false); resetForm(); },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: DepartmentUpdatePayload }) => api.updateDepartment(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [queryKeys.departments] }); setEditId(null); resetForm(); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteDepartment(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [queryKeys.departments] }); setError(''); },
    onError: (e: Error) => setError(e.message),
  });

  const resetForm = () => { setForm({ code: '', name: '', is_active: true }); setError(''); };

  const openEdit = (d: Department) => {
    setForm({ code: d.code, name: d.name, is_active: d.is_active });
    setEditId(d.id);
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
    <>
      <TabHeader title="Departments" subtitle="Organizational units for employee assignment" actions={
        <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}><Plus className="w-4 h-4" /> Add Department</Button>
      } />
      {error && !showCreate && editId === null && <p className={`${alertErrorClass} mb-3`}>{error}</p>}

      <DataTable loading={isLoading && !departments} headers={['Code', 'Name', 'Status', 'Actions']} emptyMessage="No departments" minWidth="520px">
        {departments?.map((d) => (
          <tr key={d.id}>
            <td className="font-mono text-xs font-medium">{d.code}</td>
            <td>{d.name}</td>
            <td><StatusBadge active={d.is_active} /></td>
            <td className="text-right">
              <div className="inline-flex items-center gap-3">
                <button type="button" onClick={() => openEdit(d)} className="text-brand-600 hover:text-brand-700 text-sm font-medium inline-flex items-center gap-1">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete department ${d.code}? Only allowed if no employees are assigned.`)) {
                      deleteMutation.mutate(d.id);
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
      <Modal title={editId ? 'Edit Department' : 'Add Department'} open={showCreate || editId !== null} onClose={() => { setShowCreate(false); setEditId(null); resetForm(); }}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className={alertErrorClass}>{error}</p>}
          {!editId && <div><label className={labelClass}>Code</label><input required className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>}
          <div><label className={labelClass}>Name</label><input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className={labelClass}>Active</label><select className={selectClass} value={form.is_active ? 'true' : 'false'} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}><option value="true">Active</option><option value="false">Inactive</option></select></div>
          <ModalActions onCancel={() => { setShowCreate(false); setEditId(null); }} pending={createMutation.isPending || updateMutation.isPending} submitLabel={editId ? 'Save Changes' : 'Create'} />
        </form>
      </Modal>
    </>
  );
}
