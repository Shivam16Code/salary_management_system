import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

export interface MultiSelectOption<T extends string | number> {
  value: T;
  label: string;
}

interface MultiSelectProps<T extends string | number> {
  label?: string;
  options: MultiSelectOption<T>[];
  value: T[];
  onChange: (value: T[]) => void;
  placeholder?: string;
  className?: string;
}

export default function MultiSelect<T extends string | number>({
  label,
  options,
  value,
  onChange,
  placeholder = 'All',
  className = '',
}: MultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (optionValue: T) => {
    onChange(
      value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue],
    );
  };

  const selectedLabels = options
    .filter((o) => value.includes(o.value))
    .map((o) => o.label);

  const triggerText = selectedLabels.length === 0
    ? placeholder
    : selectedLabels.length <= 2
      ? selectedLabels.join(', ')
      : `${selectedLabels.length} selected`;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label && <span className="label">{label}</span>}
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={`input w-full text-left flex items-center justify-between gap-2 pr-2 ${
          value.length === 0 ? 'text-slate-400' : 'text-slate-900'
        }`}
      >
        <span className="truncate">{triggerText}</span>
        <span className="flex items-center gap-1 shrink-0">
          {value.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear selection"
              className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange([]);
                }
              }}
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1"
        >
          {options.map((option) => {
            const checked = value.includes(option.value);
            return (
              <li key={String(option.value)} role="option" aria-selected={checked}>
                <label className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
                    checked={checked}
                    onChange={() => toggle(option.value)}
                  />
                  <span className={checked ? 'font-medium text-slate-900' : 'text-slate-700'}>
                    {option.label}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
