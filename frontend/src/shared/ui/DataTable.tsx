import type { ReactNode } from 'react';

interface DataTableProps {
  headers: string[];
  loading?: boolean;
  emptyMessage?: string;
  children: ReactNode;
  colSpan?: number;
  minWidth?: string;
}

export default function DataTable({
  headers,
  loading = false,
  emptyMessage = 'No data found',
  children,
  colSpan,
  minWidth = '640px',
}: DataTableProps) {
  const cols = colSpan ?? headers.length;
  const hasRows = !loading && children && (!Array.isArray(children) || children.length > 0);

  return (
    <div className="card overflow-hidden">
      <div className="table-wrap">
        <table className="table" style={{ minWidth: minWidth === '0' ? undefined : minWidth }}>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} className={h === 'Actions' ? 'text-right' : ''}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={cols} className="text-center py-12 text-slate-400">
                  Loading...
                </td>
              </tr>
            ) : !hasRows ? (
              <tr>
                <td colSpan={cols} className="text-center py-12 text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
