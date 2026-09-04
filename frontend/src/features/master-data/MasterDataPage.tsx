import { useState } from 'react';
import PageHeader from '@/shared/ui/PageHeader';
import CountriesTab from './components/CountriesTab';
import CurrenciesTab from './components/CurrenciesTab';
import DepartmentsTab from './components/DepartmentsTab';
import JobLevelsTab from './components/JobLevelsTab';

type Tab = 'currencies' | 'countries' | 'departments' | 'job-levels';

const tabs: { id: Tab; label: string }[] = [
  { id: 'countries', label: 'Countries' },
  { id: 'currencies', label: 'Currencies' },
  { id: 'departments', label: 'Departments' },
  { id: 'job-levels', label: 'Job Levels' },
];

export default function MasterDataPage() {
  const [tab, setTab] = useState<Tab>('countries');

  return (
    <div className="page-stack">
      <PageHeader
        title="Master Data"
        subtitle="Add countries to configure currencies automatically, then manage departments and job levels"
      />

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={tab === t.id ? 'tab-active' : 'tab-inactive'}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'countries' && <CountriesTab />}
      {tab === 'currencies' && <CurrenciesTab />}
      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'job-levels' && <JobLevelsTab />}
    </div>
  );
}
