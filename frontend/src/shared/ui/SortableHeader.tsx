import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

export default function SortableHeader({
  label,
  sortKey,
  align,
  activeSort,
  sortOrder,
  onSort,
}: {
  label: string;
  sortKey?: string;
  align?: 'right';
  activeSort?: string;
  sortOrder?: string;
  onSort: (key: string) => void;
}) {
  const isActive = sortKey && activeSort === sortKey;
  const thClass = align === 'right' ? 'text-right' : 'text-left';

  if (!sortKey) {
    return <th className={`px-4 py-3 ${thClass}`}>{label}</th>;
  }

  return (
    <th className={`px-4 py-3 ${thClass}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
          isActive ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800'
        } ${align === 'right' ? 'ml-auto' : ''}`}
      >
        {label}
        {isActive ? (
          sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
        )}
      </button>
    </th>
  );
}
