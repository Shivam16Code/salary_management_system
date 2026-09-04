import { X } from 'lucide-react';

/** Active filter chip used on analytics and list filter bars. */
export default function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove?: () => void;
}) {
  return (
    <span className="filter-chip">
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} className="hover:text-brand-900" aria-label={`Remove ${label}`}>
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
