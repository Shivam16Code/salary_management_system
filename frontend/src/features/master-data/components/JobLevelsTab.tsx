import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  api,
  queryKeys,
  type JobLevel,
  type JobLevelCreatePayload,
  type JobLevelUpdatePayload,
  inputClass,
  selectClass,
  labelClass,
  alertErrorClass,
} from '@/shared/api';
import Modal from '@/shared/components/Modal';
import DataTable from '@/shared/ui/DataTable';
import Button from '@/shared/ui/Button';
import { ModalActions, StatusBadge, TabHeader } from './MasterDataBits';

export default function JobLevelsTab() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState<JobLevelCreatePayload>({ code: '', name: '', description: '', is_active: true });

  const { data: jobLevels, isLoading } = useQuery({ queryKey: [queryKeys.jobLevels, false], queryFn: () => api.getJobLevels(false) });

  const createMutation = useMutation({
    mutationFn: api.createJobLevel,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [queryKeys.jobLevels] }); setShowCreate(false); resetForm(); },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: JobLevelUpdatePayload }) => api.updateJobLevel(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [queryKeys.jobLevels] }); setEditId(null); resetForm(); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteJobLevel(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [queryKeys.jobLevels] }); setError(''); },
    onError: (e: Error) => setError(e.message),
  });

  const resetForm = () => { setForm({ code: '', name: '', description: '', is_active: true }); setError(''); };

  const openEdit = (l: JobLevel) => {
    setForm({ code: l.code, name: l.name, description: l.description ?? '', is_active: l.is_active });
    setEditId(l.id);
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
      <TabHeader title="Job Levels" subtitle="Career levels used when assigning employees" actions={
        <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}><Plus className="w-4 h-4" /> Add Job Level</Button>
      } />
      {error && !showCreate && editId === null && <p className={`${alertErrorClass} mb-3`}>{error}</p>}

      <DataTable loading={isLoading && !jobLevels} headers={['Code', 'Name', 'Description', 'Status', 'Actions']} emptyMessage="No job levels" minWidth="680px">
        {jobLevels?.map((l) => (
          <tr key={l.id}>
            <td className="font-mono text-xs font-medium">{l.code}</td>
            <td>{l.name}</td>
            <td className="text-slate-500 text-xs max-w-[200px] truncate">{l.description ?? '—'}</td>
            <td><StatusBadge active={l.is_active} /></td>
            <td className="text-right">
              <div className="inline-flex items-center gap-3">
                <button type="button" onClick={() => openEdit(l)} className="text-brand-600 hover:text-brand-700 text-sm font-medium inline-flex items-center gap-1">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete job level ${l.code}? Only allowed if no employees are assigned.`)) {
                      deleteMutation.mutate(l.id);
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
      <Modal title={editId ? 'Edit Job Level' : 'Add Job Level'} open={showCreate || editId !== null} onClose={() => { setShowCreate(false); setEditId(null); resetForm(); }}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className={alertErrorClass}>{error}</p>}
          {!editId && <div><label className={labelClass}>Code</label><input required className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="L4" /></div>}
          <div><label className={labelClass}>Name</label><input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className={labelClass}>Description</label><input className={inputClass} value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className={labelClass}>Active</label><select className={selectClass} value={form.is_active ? 'true' : 'false'} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}><option value="true">Active</option><option value="false">Inactive</option></select></div>
          <ModalActions onCancel={() => { setShowCreate(false); setEditId(null); }} pending={createMutation.isPending || updateMutation.isPending} submitLabel={editId ? 'Save Changes' : 'Create'} />
        </form>
      </Modal>
    </>
  );
}
