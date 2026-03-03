"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type BalancePoint = {
  date: string;
  balance: number;
};

type BalanceChartProps = {
  data: BalancePoint[];
};

export function BalanceChart({ data }: BalanceChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/40 text-sm text-slate-400">
        No balance data available for the last 7 days.
      </div>
    );
  }

  return (
    <div className="h-64 w-full rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <h2 className="mb-3 text-sm font-medium text-slate-200">
        7-day balance
      </h2>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#020617",
              borderColor: "#1e293b",
              borderRadius: 6,
              padding: "6px 8px"
            }}
            labelStyle={{ fontSize: 11, color: "#e2e8f0" }}
            itemStyle={{ fontSize: 11, color: "#cbd5f5" }}
          />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

