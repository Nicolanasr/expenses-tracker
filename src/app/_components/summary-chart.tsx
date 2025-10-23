/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from 'chart.js';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type TimelinePoint = {
    label: string;
    income: number;
    expenses: number;
};

type SummaryChartProps = {
    interval: 'month' | 'week';
    points: TimelinePoint[];
};

const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
});

export function SummaryChart({ interval, points }: SummaryChartProps) {
    const labels = points.map((point) => point.label);

    const data: ChartData<'bar'> = {
        labels,
        datasets: [
            {
                label: 'Income',
                data: points.map((point) => point.income),
                backgroundColor: 'rgba(34,197,94,0.6)',
                borderRadius: 6,
            },
            {
                label: 'Expenses',
                data: points.map((point) => point.expenses),
                backgroundColor: 'rgba(239,68,68,0.6)',
                borderRadius: 6,
            },
        ],
    };

    const options: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    boxWidth: 12,
                },
            },
            tooltip: {
                callbacks: {
                    label(context: any) {
                        const value = context.parsed.y ?? 0;
                        return `${context.dataset.label}: ${formatter.format(value)}`;
                    },
                },
            },
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: interval === 'month' ? 'Month' : 'Week',
                },
                ticks: {
                    maxRotation: 0,
                    minRotation: 0,
                },
            },
            y: {
                title: {
                    display: true,
                    text: 'Amount',
                },
                ticks: {
                    callback(value: any) {
                        if (typeof value === 'number') {
                            return formatter.format(value);
                        }
                        return value;
                    },
                },
            },
        },
    };

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2">
                <h3 className="text-base font-semibold text-slate-900">
                    {interval === 'month' ? 'Monthly summary' : 'Weekly summary'}
                </h3>
            </div>
            <div className="h-72">
                <Bar data={data} options={options} />
            </div>
        </section>
    );
}
