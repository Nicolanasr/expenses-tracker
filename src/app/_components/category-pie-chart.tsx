'use client';

import { Doughnut } from 'react-chartjs-2';
import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
  type TooltipItem,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

type CategoryBreakdown = {
  label: string;
  amount: number;
  color: string;
};

type CategoryPieChartProps = {
  data: CategoryBreakdown[];
};

const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  if (data.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        No expense data available for this period.
      </section>
    );
  }

  const chartData = {
    labels: data.map((item) => item.label),
    datasets: [
      {
        data: data.map((item) => item.amount),
        backgroundColor: data.map((item) => item.color),
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 12,
        },
      },
      tooltip: {
        callbacks: {
          label(context: TooltipItem<'doughnut'>) {
            const label = context.label ?? '';
            const value = Number(context.parsed ?? 0);
            return `${label}: ${formatter.format(value)}`;
          },
        },
      },
    },
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="pb-2 text-base font-semibold text-slate-900">
        Expenses by category
      </h3>
      <div className="h-72">
        <Doughnut data={chartData} options={options} />
      </div>
    </section>
  );
}
