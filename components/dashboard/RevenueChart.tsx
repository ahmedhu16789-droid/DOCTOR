import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const data = [
  { name: 'Mon', revenue: 4000 },
  { name: 'Tue', revenue: 3000 },
  { name: 'Wed', revenue: 5500 },
  { name: 'Thu', revenue: 4500 },
  { name: 'Fri', revenue: 6000 },
  { name: 'Sat', revenue: 7500 },
  { name: 'Sun', revenue: 5000 },
];

export const RevenueChart: React.FC = () => {
  const { t } = useTranslation();
  const [tooltip, setTooltip] = useState<{ x: number; y: number; value: number; label: string } | null>(null);

  const width = 560;
  const height = 220;
  const padL = 40;
  const padR = 20;
  const padT = 10;
  const padB = 40;

  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxVal = Math.max(...data.map(d => d.revenue));
  const minVal = 0;

  const xStep = chartW / (data.length - 1);

  const toX = (i: number) => padL + i * xStep;
  const toY = (v: number) => padT + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;

  const points = data.map((d, i) => ({ x: toX(i), y: toY(d.revenue), ...d }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${padT + chartH} L${points[0].x},${padT + chartH} Z`;

  const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal].reverse();

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">{t('revenue_analytics')}</h3>
          <p className="text-sm text-gray-500">{t('weekly_income')}</p>
        </div>
        <select className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-sky-500 outline-none">
          <option>{t('last_7_days')}</option>
        </select>
      </div>

      <div className="flex-1 w-full relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          style={{ minHeight: 180 }}
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padL} y1={toY(tick)}
                x2={padL + chartW} y2={toY(tick)}
                stroke="#f1f5f9" strokeWidth="1"
              />
              <text
                x={padL - 6} y={toY(tick) + 4}
                textAnchor="end"
                fontSize="10"
                fill="#94a3b8"
              >
                {tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick}
              </text>
            </g>
          ))}

          {/* Area fill */}
          <path d={areaPath} fill="url(#revenueGrad)" />

          {/* Line */}
          <path d={linePath} fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Points + hover areas */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="#0ea5e9" stroke="white" strokeWidth="2" />
              <rect
                x={p.x - xStep / 2} y={padT}
                width={xStep} height={chartH}
                fill="transparent"
                onMouseEnter={() => setTooltip({ x: p.x, y: p.y, value: p.revenue, label: p.name })}
              />
              <text
                x={p.x} y={padT + chartH + 20}
                textAnchor="middle"
                fontSize="11"
                fill="#64748b"
              >
                {p.name}
              </text>
            </g>
          ))}

          {/* Tooltip */}
          {tooltip && (
            <g>
              <line x1={tooltip.x} y1={padT} x2={tooltip.x} y2={padT + chartH} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 2" />
              <rect
                x={tooltip.x - 36} y={tooltip.y - 32}
                width="72" height="24"
                rx="6"
                fill="#0f172a"
              />
              <text
                x={tooltip.x} y={tooltip.y - 16}
                textAnchor="middle"
                fontSize="11"
                fill="white"
                fontWeight="600"
              >
                {tooltip.value.toLocaleString()}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};