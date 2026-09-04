import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query';
import Layout from '@/app/Layout';
import { DashboardPage } from '@/features/analytics';
import { EmployeeListPage, EmployeeDetailPage } from '@/features/employees';
import { SalaryComponentsPage } from '@/features/salary-components';
import { MasterDataPage } from '@/features/master-data';
import { SalaryRecordsPage } from '@/features/salary-records';
import { ExchangeRatesPage } from '@/features/exchange-rates';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      placeholderData: keepPreviousData,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/employees" element={<EmployeeListPage />} />
            <Route path="/employees/:id" element={<EmployeeDetailPage />} />
            <Route path="/salary-components" element={<SalaryComponentsPage />} />
            <Route path="/master-data" element={<MasterDataPage />} />
            <Route path="/salary-records" element={<SalaryRecordsPage />} />
            <Route path="/exchange-rates" element={<ExchangeRatesPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
