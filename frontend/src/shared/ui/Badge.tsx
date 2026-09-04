type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'earning' | 'deduction';

const variantClass: Record<BadgeVariant, string> = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  neutral: 'badge-neutral',
  info: 'badge-info',
  earning: 'badge-earning',
  deduction: 'badge-deduction',
};

export function employmentBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'ON_LEAVE':
      return 'warning';
    case 'TERMINATED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export default function Badge({
  children,
  variant = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return <span className={`${variantClass[variant]} ${className}`.trim()}>{children}</span>;
}
