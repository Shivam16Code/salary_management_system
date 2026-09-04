/** KPI / summary metric card used on Dashboard and Salary Records. */
export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">{title}</p>
          <p className="text-xl sm:text-2xl font-bold mt-1 text-slate-900 truncate" title={value}>{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{subtitle}</p>}
        </div>
        <div className={`p-2.5 sm:p-3 rounded-xl shrink-0 ${color}`}>
          <Icon className="w-5 h-5 text-white" aria-hidden />
        </div>
      </div>
    </div>
  );
}
