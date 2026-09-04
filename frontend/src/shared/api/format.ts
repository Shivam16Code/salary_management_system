export function formatCurrency(amount: number | null, symbol = '', currency = ''): string {
  if (amount === null || amount === undefined) return '—';
  const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(amount));
  return `${symbol}${formatted}${currency ? ` ${currency}` : ''}`;
}

/** Compact currency for KPI cards and large totals (e.g. 404.5M USD). */
export function formatCompactCurrency(amount: number | null, currency = ''): string {
  if (amount === null || amount === undefined) return '—';
  const n = Number(amount);
  const abs = Math.abs(n);
  let compact: string;
  if (abs >= 1_000_000_000) compact = `${(n / 1_000_000_000).toFixed(2)}B`;
  else if (abs >= 1_000_000) compact = `${(n / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) compact = `${(n / 1_000).toFixed(1)}K`;
  else compact = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
  return currency ? `${compact} ${currency}` : compact;
}
