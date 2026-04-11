"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface AnalyticsActivityChartProps {
  data: Array<{ date: string; count: number }>;
}

export function AnalyticsActivityChart({ data }: AnalyticsActivityChartProps) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="var(--fg-muted)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis
            allowDecimals={false}
            stroke="var(--fg-muted)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            dx={-10}
          />
          <Tooltip
            cursor={{ fill: "var(--accent-soft)" }}
            contentStyle={{
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "12px",
              color: "var(--fg-primary)",
            }}
            itemStyle={{ color: "var(--fg-primary)" }}
          />
          <Bar dataKey="count" fill="var(--fg-primary)" radius={[6, 6, 0, 0]} maxBarSize={34} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
