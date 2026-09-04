export default function Spinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClass = size === 'sm' ? 'spinner-sm' : size === 'lg' ? 'spinner-lg' : 'spinner-md';
  return (
    <div className={`flex items-center justify-center ${className}`.trim()} role="status" aria-label="Loading">
      <div className={sizeClass} />
    </div>
  );
}

export function PageLoader() {
  return <Spinner size="lg" className="py-20" />;
}

/** Inline status used while results stay on screen during a filter refetch. */
export function FetchingIndicator({ show, label = 'Updating results' }: { show: boolean; label?: string }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-brand-600 font-medium" role="status">
      <span className="spinner-sm !h-3.5 !w-3.5" />
      {label}
    </span>
  );
}
