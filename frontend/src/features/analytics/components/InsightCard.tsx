export default function InsightCard({ title, value, hint, tone = 'neutral' }: {
  title: string; value: string; hint?: string; tone?: 'neutral' | 'good' | 'warn' | 'info';
}) {
  const toneClass = {
    neutral: 'border-slate-200 bg-white',
    good: 'border-emerald-200 bg-emerald-50/40',
    warn: 'border-amber-200 bg-amber-50/40',
    info: 'border-brand-200 bg-brand-50/40',
  }[tone];
  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${toneClass}`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
      <p className="text-lg sm:text-xl font-bold text-slate-900 mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
