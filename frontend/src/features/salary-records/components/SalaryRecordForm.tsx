import { Plus, Trash2 } from 'lucide-react';
import {
  type SalaryComponent,
  type SalaryRecord,
  type SalaryRecordComponentPayload,
  inputClass,
  selectClass,
  labelClass,
} from '@/shared/api';
import Button from '@/shared/ui/Button';

export interface ComponentLine {
  key: string;
  salary_component_id: number;
  amount: number;
  units?: number;
}

export function buildDefaultLines(
  components: SalaryComponent[],
  profile?: { base_salary: number } | null,
): ComponentLine[] {
  // BASIC is injected server-side from the salary profile — user adds optional extras only.
  if (profile) return [];

  const basic = components.find((c) => c.code === 'BASIC');
  const hra = components.find((c) => c.code === 'HRA');
  const lines: ComponentLine[] = [];
  if (basic) {
    lines.push({ key: 'basic', salary_component_id: basic.id, amount: 0 });
  }
  if (hra) lines.push({ key: 'hra', salary_component_id: hra.id, amount: 40 });
  if (lines.length === 0 && components[0]) {
    lines.push({ key: '1', salary_component_id: components[0].id, amount: 0 });
  }
  return lines;
}

export function linesFromRecord(record: SalaryRecord, excludeComponentId?: number): ComponentLine[] {
  return record.components
    .filter((c) => !excludeComponentId || c.salary_component_id !== excludeComponentId)
    .map((c, i) => ({
      key: `existing-${c.id ?? i}`,
      salary_component_id: c.salary_component_id ?? 0,
      amount: Number(c.amount ?? 0),
      units: c.units != null ? Number(c.units) : undefined,
    }));
}

export function linesToPayload(lines: ComponentLine[]): SalaryRecordComponentPayload[] {
  return lines
    .filter((l) => l.salary_component_id > 0)
    .map(({ salary_component_id, amount, units }) => ({
      salary_component_id,
      amount,
      ...(units != null && units > 0 ? { units } : {}),
    }));
}

function amountLabel(method: string): string {
  if (method === 'PERCENTAGE') return 'Percentage (%)';
  if (method === 'PER_UNIT') return 'Rate per unit';
  return 'Amount';
}

interface SalaryRecordFormProps {
  components: SalaryComponent[];
  lines: ComponentLine[];
  onChange: (lines: ComponentLine[]) => void;
  currencySymbol?: string;
  autoBasicFromProfile?: boolean;
}

export default function SalaryRecordForm({
  components,
  lines,
  onChange,
  currencySymbol = '',
  autoBasicFromProfile = false,
}: SalaryRecordFormProps) {
  const selectableComponents = autoBasicFromProfile
    ? components.filter((c) => c.code !== 'BASIC')
    : components;
  const usedIds = new Set(lines.map((l) => l.salary_component_id));
  const minLines = autoBasicFromProfile ? 0 : 1;

  const addLine = () => {
    const available = selectableComponents.find((c) => !usedIds.has(c.id));
    if (!available) return;
    onChange([...lines, { key: `new-${Date.now()}`, salary_component_id: available.id, amount: 0 }]);
  };

  const updateLine = (key: string, patch: Partial<ComponentLine>) => {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const removeLine = (key: string) => {
    if (lines.length <= minLines) return;
    onChange(lines.filter((l) => l.key !== key));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <label className={labelClass}>
          {autoBasicFromProfile ? 'Additional Components' : 'Salary Components'}
        </label>
        <Button type="button" variant="secondary" size="sm" onClick={addLine}>
          <Plus className="w-3.5 h-3.5" /> Add Component
        </Button>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-lg">
          {autoBasicFromProfile
            ? 'Basic salary is applied automatically. Add optional components such as HRA, overtime, or deductions.'
            : 'Add at least one salary component'}
        </p>
      ) : (
        lines.map((line) => {
          const meta = components.find((c) => c.id === line.salary_component_id);
          const method = meta?.calculation_method ?? 'FIXED';
          const isDeduction = meta?.component_type === 'DEDUCTION';

          return (
            <div
              key={line.key}
              className={`border rounded-xl p-3 sm:p-4 space-y-3 ${
                isDeduction ? 'border-red-200/80 bg-red-50/40' : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <select
                    required
                    className={selectClass}
                    value={line.salary_component_id || ''}
                    onChange={(e) => updateLine(line.key, { salary_component_id: Number(e.target.value), amount: 0, units: undefined })}
                  >
                    <option value="">Select component</option>
                    {selectableComponents.map((c) => (
                      <option
                        key={c.id}
                        value={c.id}
                        disabled={c.id !== line.salary_component_id && usedIds.has(c.id)}
                      >
                        {c.code} — {c.name} ({c.component_type}, {c.calculation_method})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  disabled={lines.length <= minLines}
                  className="btn-icon text-red-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 shrink-0"
                  title="Remove component"
                  aria-label="Remove component"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className={`grid gap-3 ${method === 'PER_UNIT' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className={labelClass}>
                    {amountLabel(method)}{currencySymbol && method === 'FIXED' ? ` (${currencySymbol})` : ''}
                  </label>
                  <input
                    required
                    type="number"
                    min={0}
                    step={method === 'PERCENTAGE' ? '0.01' : '1'}
                    max={method === 'PERCENTAGE' ? 100 : undefined}
                    className={inputClass}
                    value={line.amount || ''}
                    onChange={(e) => updateLine(line.key, { amount: Number(e.target.value) })}
                  />
                </div>
                {method === 'PER_UNIT' && (
                  <div>
                    <label className={labelClass}>Units (e.g. hours)</label>
                    <input
                      required
                      type="number"
                      min={0}
                      step="0.5"
                      className={inputClass}
                      value={line.units ?? ''}
                      onChange={(e) => updateLine(line.key, { units: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>

              {method === 'PERCENTAGE' && (
                <p className="text-xs text-slate-400">Calculated as percentage of Basic Salary on this record</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
