import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { AnalyticsBreakdown } from '@/shared/api';
import { formatCurrency } from '@/shared/api';
import { Card } from '@/shared/ui/Card';

export default function ChartCard({ title, data, currency, dateHint }: {
  title: string;
  data: AnalyticsBreakdown[];
  currency: string;
  dateHint: string;
}) {
  const chartData = data.map((d) => ({
    name: d.group_label,
    avg: Number(d.average_compensation),
    count: d.employee_count,
  }));
  const chartTotal = chartData.reduce((sum, row) => sum + row.count, 0);

  return (
    <Card padding>
      <h3 className="section-title mb-1">{title}</h3>
      <p className="text-xs text-slate-400 mb-4">
        {dateHint} · {chartTotal.toLocaleString()} employees
      </p>
      {chartData.length === 0 ? (
        <p className="text-slate-400 text-center py-12 text-sm">No data for selected filters</p>
      ) : (
        <div className="w-full h-[260px] sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} height={60} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}K`} width={48} />
              <Tooltip formatter={(value) => [formatCurrency(Number(value), '', currency), 'Avg Compensation']} />
              <Bar dataKey="avg" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
