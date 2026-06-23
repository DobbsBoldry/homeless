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
// Type-only import from the pure metric module — no server code reaches the
// client bundle (deep import, never a domain barrel).
import type { WeeklyTrendPoint } from '@/lib/cwt/time-saved-metric';

const tickFmt = (weekStart: string) => {
  // YYYY-MM-DD -> M/D (week of)
  const [, m, d] = weekStart.split('-');
  return `${Number(m)}/${Number(d)}`;
};

const minutesFmt = (v: number | null) =>
  v == null ? '—' : v >= 60 ? `${(v / 60).toFixed(1)}h` : `${Math.round(v)}m`;

export function TimeSavedChart({ data }: { data: WeeklyTrendPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="weekStart" tickFormatter={tickFmt} fontSize={11} stroke="currentColor" />
          <YAxis
            tickFormatter={(v) => minutesFmt(v as number)}
            fontSize={11}
            stroke="currentColor"
            width={48}
          />
          <Tooltip
            formatter={(value) => minutesFmt(value as number | null)}
            labelFormatter={(label) => `Week of ${label}`}
            contentStyle={{ fontSize: 12 }}
            cursor={{ stroke: 'hsl(var(--border))' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="avgMinutesToDraft"
            name="Weekly avg time-to-draft"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="rolling4WeekAvgMinutes"
            name="4-week rolling avg"
            stroke="#10b981"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
