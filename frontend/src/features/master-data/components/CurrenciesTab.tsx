import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '@/shared/api';
import DataTable from '@/shared/ui/DataTable';
import { StatusBadge, TabHeader } from './MasterDataBits';

export default function CurrenciesTab() {
  const { data: currencies, isLoading } = useQuery({
    queryKey: [queryKeys.currencies, false],
    queryFn: () => api.getCurrencies(false),
  });

  return (
    <>
      <TabHeader
        title="Currencies"
        subtitle="Currencies in the application — added automatically when you create a country"
      />
      <DataTable
        loading={isLoading && !currencies}
        headers={['Code', 'Name', 'Symbol', 'Decimals', 'Status']}
        emptyMessage="No currencies yet. Add a country first — its currency will appear here automatically."
        minWidth="560px"
      >
        {currencies?.map((c) => (
          <tr key={c.id}>
            <td className="font-mono text-xs font-medium text-slate-700">{c.code}</td>
            <td>{c.name}</td>
            <td>{c.symbol}</td>
            <td className="tabular-nums">{c.decimal_places}</td>
            <td><StatusBadge active={c.is_active} /></td>
          </tr>
        ))}
      </DataTable>
    </>
  );
}
