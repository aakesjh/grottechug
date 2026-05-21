import { useMemo } from "react";

type Attempt = {
  participantId: string;
  name: string;
  seconds: number;
};

type Props = {
  attempts: Attempt[];
  history: Record<string, number[]>; // participantId -> chronological seconds incl. today
  onSelect: (participantId: string) => void;
};

const N = 5;

export function SessionFormTrend({ attempts, history, onSelect }: Props) {
  const rows = useMemo(() => {
    return attempts
      .map((a) => {
        const series = (history[a.participantId] ?? []).slice(-N);
        return { ...a, series };
      })
      .filter((r) => r.series.length >= 2)
      .sort((a, b) => {
        // Sort by trend slope (improving = first)
        const slope = (xs: number[]) => {
          const n = xs.length;
          const sumX = xs.reduce((acc, _, i) => acc + i, 0);
          const sumY = xs.reduce((acc, v) => acc + v, 0);
          const sumXY = xs.reduce((acc, v, i) => acc + i * v, 0);
          const sumXX = xs.reduce((acc, _, i) => acc + i * i, 0);
          const denom = n * sumXX - sumX * sumX;
          return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
        };
        return slope(a.series) - slope(b.series);
      });
  }, [attempts, history]);

  if (rows.length === 0) return null;

  return (
    <div className="card session-trend">
      <h2 className="session-trend__title">Form-kurve siste {N} forsøk</h2>
      <div className="session-trend__desc">
        Linja faller når tida blir bedre. Sortert fra mest i form til minst.
      </div>
      <ul className="session-trend__list">
        {rows.map((r) => {
          const min = Math.min(...r.series);
          const max = Math.max(...r.series);
          const range = Math.max(0.01, max - min);
          const w = 120;
          const h = 32;
          const stepX = r.series.length > 1 ? w / (r.series.length - 1) : 0;
          const points = r.series
            .map((v, i) => {
              const x = i * stepX;
              const y = h - ((v - min) / range) * h;
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
          const firstY = h - ((r.series[0] - min) / range) * h;
          const lastY = h - ((r.series[r.series.length - 1] - min) / range) * h;
          const improving = r.series[r.series.length - 1] < r.series[0];
          const stroke = improving ? "#10b981" : "#ef4444";
          const delta = r.series[r.series.length - 1] - r.series[0];

          return (
            <li key={r.participantId} className="session-trend__row">
              <button
                type="button"
                className="session-trend__name"
                onClick={() => onSelect(r.participantId)}
              >
                {r.name}
              </button>
              <svg
                className="session-trend__spark"
                viewBox={`-2 -4 ${w + 4} ${h + 8}`}
                width={w}
                height={h}
              >
                <polyline
                  fill="none"
                  stroke={stroke}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={points}
                />
                <circle cx={0} cy={firstY} r={2.5} fill="rgba(255,255,255,0.5)" />
                <circle cx={(r.series.length - 1) * stepX} cy={lastY} r={3.5} fill={stroke} />
              </svg>
              <div className="session-trend__numbers">
                <span className="session-trend__current">{r.seconds.toFixed(2)}s</span>
                <span
                  className={`session-trend__delta ${delta < 0 ? "session-trend__delta--good" : delta > 0 ? "session-trend__delta--bad" : ""}`}
                >
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(2)}s
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
