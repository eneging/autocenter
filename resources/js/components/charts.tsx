import React, { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';

export function IncomeExpenseChart({ data }: { data: { month: string; income: number; expenses: number }[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: data.map((item) => item.month),
        datasets: [
          { label: 'Ingresos', data: data.map((item) => item.income), backgroundColor: '#0b0b0c', borderRadius: 6, maxBarThickness: 28 },
          { label: 'Egresos', data: data.map((item) => item.expenses), backgroundColor: '#d71920', borderRadius: 6, maxBarThickness: 28 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 100,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } },
        },
        scales: {
          x: { ticks: { autoSkip: true, maxRotation: 0, font: { size: 10 } }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { font: { size: 10 } } },
        },
      },
    });
    return () => chart.destroy();
  }, [data]);

  return (
    <div className="chart-wrap">
      <canvas ref={ref} />
    </div>
  );
}
