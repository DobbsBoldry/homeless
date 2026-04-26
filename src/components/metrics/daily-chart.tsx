'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyPoint } from '@/db/queries/metrics';

const tickFmt = (day: string) => {
  // YYYY-MM-DD -> M/D
  const [, m, d] = day.split('-');
  return `${Number(m)}/${Number(d)}`;
};

export function DailyChart({ data }: { data: DailyPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="day" tickFormatter={tickFmt} fontSize={11} stroke="currentColor" />
          <YAxis allowDecimals={false} fontSize={11} stroke="currentColor" />
          <Tooltip
            labelFormatter={(label) => label}
            contentStyle={{ fontSize: 12 }}
            cursor={{ stroke: 'hsl(var(--border))' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="filings"
            name="Filings"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="packetsApproved"
            name="Packets approved"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
