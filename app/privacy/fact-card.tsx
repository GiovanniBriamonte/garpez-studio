import type { ReactNode } from 'react';

export function FactCard({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="fact-card">
      {rows.map((row) => (
        <div className="fact-row" key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
