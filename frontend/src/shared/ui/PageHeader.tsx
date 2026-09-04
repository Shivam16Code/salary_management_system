import type { ReactNode } from 'react';

export default function PageHeader({
  title,
  subtitle,
  actions,
  meta,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {(subtitle || meta) && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 mt-1">
            {subtitle && <p className="page-subtitle sm:mt-0">{subtitle}</p>}
            {meta}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
