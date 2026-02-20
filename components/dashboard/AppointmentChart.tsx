import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getDashboardAnalytics, DashboardVisitPoint } from '../../services/dashboardRepository';

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#ec4899'];

interface Props {
  branchId?: string;
}

export const AppointmentChart: React.FC<Props> = ({ branchId }) => {
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardVisitPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    getDashboardAnalytics(branchId, controller.signal)
      .then((res) => setData(res.visits_by_dept ?? []))
      .catch((err) => {
        if (err?.name !== 'AbortError') console.error('Visits chart error:', err);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [branchId]);

  const width = 520;
  const height = 200;
  const padL = 10;
  const padR = 10;
  const padT = 10;
  const padB = 36;

  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const gap = data.length > 0 ? chartW / data.length : chartW;
  const barWidth = Math.min(50, gap * 0.55);
  const rx = 6;

  const toX = (i: number) => padL + i * gap + gap / 2;
  const toY = (v: number) => padT + chartH - (v / maxVal) * chartH;
  const toH = (v: number) => (v / maxVal) * chartH;

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col">
      <h3 className="font-bold text-gray-900 text-lg mb-1">{t('visits_by_dept')}</h3>
      <p className="text-sm text-gray-500 mb-4">{t('patient_distribution')}</p>

      <div className="flex-1 w-full relative overflow-hidden" style={{ minHeight: 160 }}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-gray-400">{t('no_data_available', 'No data available')}</p>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
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

            {data.map((d, i) => {
              const cx = toX(i);
              const bh = toH(d.count);
              const by = toY(d.count);
              const isHov = hovered === i;

              return (
                <g
                  key={i}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {isHov && (
                    <rect x={cx - gap / 2} y={padT} width={gap} height={chartH} fill="#f8fafc" rx="4" />
                  )}

                  {/* Bar (rounded top) */}
                  <rect
                    x={cx - barWidth / 2} y={by}
                    width={barWidth} height={bh}
                    fill={COLORS[i % COLORS.length]}
                    opacity={isHov ? 1 : 0.85}
                    rx={rx}
                  />
                  {/* Square bottom overlap */}
                  <rect
                    x={cx - barWidth / 2} y={by + rx}
                    width={barWidth} height={Math.max(0, bh - rx)}
                    fill={COLORS[i % COLORS.length]}
                    opacity={isHov ? 1 : 0.85}
                  />

                  <text x={cx} y={padT + chartH + 22} textAnchor="middle" fontSize="10" fill="#64748b">
                    {d.name.length > 8 ? `${d.name.slice(0, 7)}…` : d.name}
                  </text>

                  {isHov && (
                    <g>
                      <rect x={cx - 22} y={by - 28} width="44" height="22" rx="6" fill="#0f172a" />
                      <text x={cx} y={by - 13} textAnchor="middle" fontSize="11" fill="white" fontWeight="600">
                        {d.count}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
};
