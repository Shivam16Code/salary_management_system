import { Link } from 'react-router-dom';
import { formatCurrency, type SalaryRecordListItem } from '@/shared/api';
import Badge from '@/shared/ui/Badge';

export default function SalaryRecordMobileCard({ record }: { record: SalaryRecordListItem }) {
  return (
    <Link
      to={`/employees/${record.employee_id}`}
      className="mobile-card block hover:shadow-[var(--shadow-elevated)] transition-shadow"
    >
      <div className="mobile-card-row">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{record.employee_name}</p>
          <p className="text-xs font-mono text-brand-600 mt-0.5">{record.employee_code}</p>
        </div>
        <Badge variant={record.payment_status === 'PAID' ? 'success' : 'warning'}>
          {record.payment_status === 'PAID' ? 'PAID' : 'NOT PAID'}
        </Badge>
      </div>
      <p className="text-sm text-slate-500 truncate">{record.job_title}</p>
      <div className="flex items-center justify-between text-sm pt-1 border-t border-slate-100">
        <span className="text-slate-500">
          {new Date(record.effective_from).toLocaleDateString()}
          {record.effective_to && ` → ${new Date(record.effective_to).toLocaleDateString()}`}
        </span>
        <span className="font-semibold tabular-nums">
          {formatCurrency(record.adjusted_compensation, record.currency_symbol, record.currency_code)}
        </span>
      </div>
    </Link>
  );
}
