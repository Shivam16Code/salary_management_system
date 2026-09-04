import { formatCurrency, type SalaryRecord } from '@/shared/api';

export function ProfileStat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${highlight ? 'bg-brand-50/60 border-brand-100' : 'bg-slate-50 border-slate-100'}`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold mt-1 tabular-nums ${highlight ? 'text-brand-700' : 'text-slate-900'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export function SalaryComponentCard({
  component,
  symbol,
}: {
  component: SalaryRecord['components'][0];
  symbol: string;
}) {
  const isDeduction = component.component_type === 'DEDUCTION';
  const detail =
    component.calculation_method === 'PERCENTAGE'
      ? `${component.amount}%`
      : component.calculation_method === 'PER_UNIT'
        ? `${component.units ?? 0} × ${formatCurrency(component.amount ?? 0, symbol)}`
        : formatCurrency(component.amount ?? 0, symbol);

  return (
    <div className={`rounded-lg px-3 py-2.5 text-xs border ${isDeduction ? 'bg-red-50/80 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`font-medium ${isDeduction ? 'text-red-700' : 'text-emerald-700'}`}>{component.component_name}</span>
        <span className="font-mono text-slate-400 text-[10px]">{component.component_code}</span>
      </div>
      <p className="text-slate-500 mt-1">{component.calculation_method} · {detail}</p>
      <p className="text-slate-800 font-semibold mt-1 tabular-nums">{formatCurrency(component.calculated_amount, symbol)}</p>
    </div>
  );
}

export function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/80 border border-slate-100">
      <div className="p-1.5 rounded-md bg-white border border-slate-100 shrink-0">
        <Icon className="w-4 h-4 text-slate-400" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-slate-800 font-medium mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}
