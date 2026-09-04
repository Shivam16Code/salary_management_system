import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  api,
  queryKeys,
  type Country,
  type CountryCreatePayload,
  type CountryReferenceItem,
  type CountryUpdatePayload,
  inputLockedClass,
  selectClass,
  labelClass,
  alertErrorClass,
} from '@/shared/api';
import Modal from '@/shared/components/Modal';
import DataTable from '@/shared/ui/DataTable';
import Button from '@/shared/ui/Button';
import { ModalActions, StatusBadge, TabHeader } from './MasterDataBits';

export default function CountriesTab() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [selectedRef, setSelectedRef] = useState<CountryReferenceItem | null>(null);
  const [editActive, setEditActive] = useState(true);

  const { data: countries, isLoading } = useQuery({
    queryKey: [queryKeys.countries, false],
    queryFn: () => api.getCountries(false),
  });

  const { data: references } = useQuery({
    queryKey: [queryKeys.countryReference],
    queryFn: () => api.getCountryReference(undefined, true),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [queryKeys.countries] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.countryReference] });
    queryClient.invalidateQueries({ queryKey: [queryKeys.currencies] });
  };

  const createMutation = useMutation({
    mutationFn: (data: CountryCreatePayload) => api.createCountry(data),
    onSuccess: () => { invalidate(); setShowCreate(false); resetForm(); },
    onError: (e: Error) => setError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CountryUpdatePayload }) => api.updateCountry(id, data),
    onSuccess: () => { invalidate(); setEditId(null); resetForm(); },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteCountry(id),
    onSuccess: () => { invalidate(); setError(''); },
    onError: (e: Error) => setError(e.message),
  });

  const resetForm = () => {
    setSelectedRef(null);
    setEditActive(true);
    setError('');
  };

  const openEdit = (c: Country) => {
    setEditActive(c.is_active);
    setEditId(c.id);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRef) {
      setError('Please select a country');
      return;
    }
    createMutation.mutate({ iso_code: selectedRef.iso_code, is_active: true });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    updateMutation.mutate({ id: editId, data: { is_active: editActive } });
  };

  const editingCountry = countries?.find((c) => c.id === editId);

  return (
    <>
      <TabHeader
        title="Countries"
        subtitle="Select a country — ISO code, name, and currency are fixed together"
        actions={
          <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}>
            <Plus className="w-4 h-4" /> Add Country
          </Button>
        }
      />

      {error && !showCreate && editId === null && <p className={`${alertErrorClass} mb-3`}>{error}</p>}

      <DataTable loading={isLoading && !countries} headers={['ISO Code', 'Name', 'Currency', 'Status', 'Actions']} emptyMessage="No countries configured" minWidth="640px">
        {countries?.map((c) => (
          <tr key={c.id}>
            <td className="font-mono text-xs font-medium">{c.iso_code}</td>
            <td>{c.name}</td>
            <td className="font-mono text-xs">{c.currency_code}</td>
            <td><StatusBadge active={c.is_active} /></td>
            <td className="text-right">
              <div className="inline-flex items-center gap-3">
                <button type="button" onClick={() => openEdit(c)} className="text-brand-600 hover:text-brand-700 text-sm font-medium inline-flex items-center gap-1">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete ${c.name}? Only allowed if no employees are assigned.`)) {
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

      <Modal title="Add Country" open={showCreate} onClose={() => { setShowCreate(false); resetForm(); }} wide>
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <p className={alertErrorClass}>{error}</p>}
          <div>
            <label className={labelClass}>Country</label>
            <select
              required
              className={selectClass}
              value={selectedRef?.iso_code ?? ''}
              onChange={(e) => {
                const ref = references?.find((r) => r.iso_code === e.target.value) ?? null;
                setSelectedRef(ref);
                setError('');
              }}
            >
              <option value="">Select a country...</option>
              {references?.map((r) => (
                <option key={r.iso_code} value={r.iso_code}>{r.name} ({r.iso_code})</option>
              ))}
            </select>
          </div>
          {selectedRef && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>ISO Code</label>
                <input readOnly className={inputLockedClass} value={selectedRef.iso_code} />
              </div>
              <div>
                <label className={labelClass}>Country Name</label>
                <input readOnly className={inputLockedClass} value={selectedRef.name} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Currency</label>
                <input readOnly className={inputLockedClass} value={selectedRef.currency_code} />
                <p className="text-xs text-slate-400 mt-1.5">Currency is locked to this country and created automatically</p>
              </div>
            </div>
          )}
          <ModalActions onCancel={() => { setShowCreate(false); resetForm(); }} pending={createMutation.isPending} submitLabel="Add Country" />
        </form>
      </Modal>

      <Modal title="Edit Country" open={editId !== null} onClose={() => { setEditId(null); resetForm(); }}>
        {editingCountry && (
          <form onSubmit={handleEdit} className="space-y-4">
            {error && <p className={alertErrorClass}>{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>ISO Code</label>
                <input readOnly className={inputLockedClass} value={editingCountry.iso_code} />
              </div>
              <div>
                <label className={labelClass}>Country Name</label>
                <input readOnly className={inputLockedClass} value={editingCountry.name} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Currency</label>
                <input readOnly className={inputLockedClass} value={editingCountry.currency_code} />
              </div>
              <div>
                <label className={labelClass}>Active</label>
                <select className={selectClass} value={editActive ? 'true' : 'false'} onChange={(e) => setEditActive(e.target.value === 'true')}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
            <ModalActions onCancel={() => { setEditId(null); resetForm(); }} pending={updateMutation.isPending} submitLabel="Save Changes" />
          </form>
        )}
      </Modal>
    </>
  );
}
