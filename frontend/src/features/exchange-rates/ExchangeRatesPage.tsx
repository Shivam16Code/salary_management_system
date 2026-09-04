import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ArrowRightLeft } from 'lucide-react';
import { api, queryKeys, selectClass, btnPrimary, labelClass } from '@/shared/api';
import PageHeader from '@/shared/ui/PageHeader';
import { Card, CardHeader } from '@/shared/ui/Card';
import Button from '@/shared/ui/Button';

export default function ExchangeRatesPage() {
  const [base, setBase] = useState('USD');
  const [pairBase, setPairBase] = useState('INR');
  const [pairTarget, setPairTarget] = useState('USD');

  const { data: currencies } = useQuery({ queryKey: [queryKeys.currencies, true], queryFn: () => api.getCurrencies(true) });

  const { data: rates, isLoading, refetch, isFetching } = useQuery({
    queryKey: [queryKeys.exchangeRates, base],
    queryFn: () => api.getExchangeRates(base),
  });

  const { data: pairRate, refetch: refetchPair } = useQuery({
    queryKey: [queryKeys.exchangeRatePair, pairBase, pairTarget],
    queryFn: () => api.getExchangeRate(pairBase, pairTarget),
    enabled: pairBase !== pairTarget,
  });

  return (
    <div className="page-stack">
      <PageHeader
        title="Exchange Rates"
        subtitle="Live rates from Frankfurter API for multi-currency reporting"
      />

      <Card>
        <CardHeader
          title="All Rates"
          subtitle={rates?.effective_date ? `Rate date: ${rates.effective_date}` : 'Select a base currency'}
          actions={
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <select value={base} onChange={(e) => setBase(e.target.value)} className={`${selectClass} min-w-[120px]`} aria-label="Base currency">
                {currencies?.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
              <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>
          }
        />
        <div className="table-wrap px-0 sm:px-0">
          <table className="table min-w-[480px]">
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th className="text-right">Rate</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && !rates ? (
                <tr><td colSpan={3} className="text-center py-10 text-slate-400">Loading rates...</td></tr>
              ) : rates?.rates.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-10 text-slate-400">No rates available</td></tr>
              ) : (
                rates?.rates.map((r) => (
                  <tr key={`${r.base}-${r.quote}`}>
                    <td className="font-mono text-sm font-medium">{r.base}</td>
                    <td className="font-mono text-sm">{r.quote}</td>
                    <td className="text-right font-medium tabular-nums">{Number(r.rate).toFixed(6)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padding>
        <div className="flex items-center gap-2 mb-4">
          <ArrowRightLeft className="w-5 h-5 text-slate-400" aria-hidden />
          <h3 className="section-title">Currency Pair Lookup</h3>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-4">
          <div className="flex-1 min-w-[140px]">
            <label className={labelClass}>From</label>
            <select value={pairBase} onChange={(e) => setPairBase(e.target.value)} className={selectClass}>
              {currencies?.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className={labelClass}>To</label>
            <select value={pairTarget} onChange={(e) => setPairTarget(e.target.value)} className={selectClass}>
              {currencies?.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => refetchPair()} className={`${btnPrimary} w-full sm:w-auto`}>Lookup</button>
        </div>

        {pairRate && pairBase !== pairTarget && (
          <div className="mt-5 p-4 sm:p-5 bg-slate-50 border border-slate-100 rounded-xl">
            <p className="text-lg sm:text-2xl font-bold text-slate-900 tabular-nums break-all">
              1 {pairRate.base} = {Number(pairRate.rate).toFixed(6)} {pairRate.quote}
            </p>
            {pairRate.effective_date && <p className="text-xs text-slate-400 mt-1.5">As of {pairRate.effective_date}</p>}
          </div>
        )}
        {pairBase === pairTarget && (
          <p className="mt-4 text-slate-500 text-sm">Same currency — rate is 1.0</p>
        )}
      </Card>
    </div>
  );
}
