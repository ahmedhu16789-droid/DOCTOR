import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const data = [
  { name: 'Ortho', count: 12 },
  { name: 'Cardio', count: 19 },
  { name: 'Dental', count: 8 },
  { name: 'Internal', count: 15 },
  { name: 'Pediatric', count: 10 },
];

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e'];

export const AppointmentChart: React.FC = () => {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<number | null>(null);

  const width = 520;
  const height = 200;
  const padL = 10;
  const padR = 10;
  const padT = 10;
  const padB = 36;

  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxVal = Math.max(...data.map(d => d.count));
  const barWidth = Math.min(50, (chartW / data.length) * 0.55);
  const gap = chartW / data.length;

  const toX = (i: number) => padL + i * gap + gap / 2;
  const toY = (v: number) => padT + chartH - (v / maxVal) * chartH;
  const toH = (v: number) => (v / maxVal) * chartH;

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col">
      <h3 className="font-bold text-gray-900 text-lg mb-1">{t('visits_by_dept')}</h3>
      <p className="text-sm text-gray-500 mb-4">{t('patient_distribution')}</p>

      <div className="flex-1 w-full relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          style={{ minHeight: 160 }}
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
            <line
              key={i}
              x1={padL} y1={padT + chartH * (1 - frac)}
              x2={padL + chartW} y2={padT + chartH * (1 - frac)}
              stroke="#f1f5f9" strokeWidth="1"
            />
          ))}

          {/* Bars */}
          {data.map((d, i) => {
            const cx = toX(i);
            const bh = toH(d.count);
            const by = toY(d.count);
            const isHov = hovered === i;
            const rx = 6;

            return (
              <g key={i}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Hover background */}
                {isHov && (
                  <rect
                    x={cx - gap / 2}
                    y={padT}
                    width={gap}
                    height={chartH}
                    fill="#f8fafc"
                    rx="4"
                  />
                )}

                {/* Bar */}
                <rect
                  x={cx - barWidth / 2}
                  y={by}
                  width={barWidth}
                  height={bh}
                  fill={COLORS[i % COLORS.length]}
                  opacity={isHov ? 1 : 0.85}
                  rx={rx}
                />

                {/* Top radius fix (bottom square) */}
                <rect
                  x={cx - barWidth / 2}
                  y={by + rx}
                  width={barWidth}
                  height={Math.max(0, bh - rx)}
                  fill={COLORS[i % COLORS.length]}
                  opacity={isHov ? 1 : 0.85}
                />

                {/* Label */}
                <text
                  x={cx}
                  y={padT + chartH + 22}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#64748b"
                >
                  {d.name}
                </text>

                {/* Tooltip on hover */}
                {isHov && (
                  <g>
                    <rect
                      x={cx - 22} y={by - 28}
                      width="44" height="22"
                      rx="6"
                      fill="#0f172a"
                    />
                    <text
                      x={cx} y={by - 13}
                      textAnchor="middle"
                      fontSize="11"
                      fill="white"
                      fontWeight="600"
                    >
                      {d.count}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
