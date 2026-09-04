import { Link } from 'react-router-dom';
import { formatCurrency, type Employee } from '@/shared/api';
import Badge, { employmentBadgeVariant } from '@/shared/ui/Badge';

export default function EmployeeMobileCard({ employee }: { employee: Employee }) {
  return (
    <Link to={`/employees/${employee.id}`} className="mobile-card block hover:shadow-[var(--shadow-elevated)] transition-shadow">
      <div className="mobile-card-row">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{employee.full_name}</p>
          <p className="text-xs font-mono text-brand-600 mt-0.5">{employee.employee_code}</p>
        </div>
        <Badge variant={employmentBadgeVariant(employee.employment_status)}>{employee.employment_status}</Badge>
      </div>
      <p className="text-sm text-slate-500 truncate">{employee.job_title}</p>
      <div className="flex items-center justify-between text-sm pt-1 border-t border-slate-100">
        <span className="text-slate-500">{employee.department_name}</span>
        <span className="font-semibold tabular-nums">{formatCurrency(employee.annual_package, employee.currency_symbol ?? '', employee.currency_code ?? '')}</span>
      </div>
    </Link>
  );
}
