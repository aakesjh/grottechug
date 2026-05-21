import { useMemo, useRef, useState, useEffect } from "react";

type Attempt = {
  participantId: string;
  name: string;
  seconds: number;
};

type Props = {
  attempts: Attempt[];
  allHistoricalTimes: number[];
  onSelect: (participantId: string) => void;
};

function quantile(sorted: number[], q: number) {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

export function SessionBeeswarm({ attempts, allHistoricalTimes, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 640;
      setWidth(Math.max(280, Math.floor(w)));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const sorted = [...allHistoricalTimes].filter((v) => v > 0).sort((a, b) => a - b);
    if (sorted.length === 0) return null;

    const q1 = quantile(sorted, 0.25);
    const median = quantile(sorted, 0.5);
    const q3 = quantile(sorted, 0.75);
    const minT = Math.min(sorted[0], ...attempts.map((a) => a.seconds));
    const maxT = Math.max(sorted[sorted.length - 1], ...attempts.map((a) => a.seconds));

    return { q1, median, q3, minT, maxT };
  }, [allHistoricalTimes, attempts]);

  if (!data || attempts.length === 0) return null;

  const padL = 12;
  const padR = 12;
  const h = 180;
  const innerW = width - padL - padR;
  const baseY = h - 36;
  const range = Math.max(0.01, data.maxT - data.minT);

  const xOf = (t: number) => padL + ((t - data.minT) / range) * innerW;

  // simple greedy beeswarm — stack circles vertically when overlapping
  const r = 8;
  const minDx = r * 2 + 1;
  const sortedAttempts = [...attempts].sort((a, b) => a.seconds - b.seconds);
  type Placed = Attempt & { x: number; y: number };
  const placed: Placed[] = [];
  sortedAttempts.forEach((a) => {
    const x = xOf(a.seconds);
    let level = 0;
    // find the lowest level where no placed circle within minDx overlaps
    while (true) {
      const yCandidate = baseY - level * (r * 2);
      const collision = placed.some((p) => {
        const dx = Math.abs(p.x - x);
        const dy = Math.abs(p.y - yCandidate);
        return dx < minDx && dy < r * 2;
      });
      if (!collision) {
        placed.push({ ...a, x, y: yCandidate });
        break;
      }
      level++;
      if (level > 50) {
        placed.push({ ...a, x, y: baseY - level * (r * 2) });
        break;
      }
    }
  });

  const xQ1 = xOf(data.q1);
  const xMed = xOf(data.median);
  const xQ3 = xOf(data.q3);

  return (
    <div className="card session-beeswarm">
      <h2 className="session-beeswarm__title">Hvor lå dagen vs. alle tider?</h2>
      <div className="session-beeswarm__desc">
        Bakgrunnsbåndet er all-time interkvartilen (25–75 %), stiplet linje er median.
      </div>
      <div className="session-beeswarm__wrap" ref={wrapRef}>
        <svg
          className="session-beeswarm__svg"
          viewBox={`0 0 ${width} ${h}`}
          width={width}
          height={h}
        >
          {/* IQR band */}
          <rect
            x={xQ1}
            y={20}
            width={Math.max(0, xQ3 - xQ1)}
            height={baseY - 20}
            fill="rgba(99,102,241,0.18)"
          />
          {/* median */}
          <line
            x1={xMed}
            x2={xMed}
            y1={20}
            y2={baseY}
            stroke="rgba(250,204,21,0.85)"
            strokeDasharray="5 4"
            strokeWidth={1.5}
          />
          {/* baseline */}
          <line
            x1={padL}
            x2={width - padR}
            y1={baseY}
            y2={baseY}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1}
          />

          {/* axis ticks */}
          {[data.minT, data.q1, data.median, data.q3, data.maxT].map((t, i) => (
            <g key={i} transform={`translate(${xOf(t)}, ${baseY})`}>
              <line y1={0} y2={4} stroke="rgba(255,255,255,0.35)" />
              <text
                y={18}
                textAnchor="middle"
                fill="var(--text)"
                fontSize={10}
                opacity={0.75}
              >
                {t.toFixed(1)}s
              </text>
            </g>
          ))}

          {/* labels */}
          <text x={xMed} y={14} textAnchor="middle" fill="#facc15" fontSize={10} fontWeight={700}>
            median
          </text>

          {/* dots */}
          {placed.map((p) => (
            <g
              key={p.participantId}
              transform={`translate(${p.x}, ${p.y})`}
              style={{ cursor: "pointer" }}
              onClick={() => onSelect(p.participantId)}
            >
              <title>{`${p.name} — ${p.seconds.toFixed(2)}s`}</title>
              <circle
                r={r}
                fill="var(--accent)"
                stroke="rgba(15,23,42,0.95)"
                strokeWidth={1.5}
              />
              <text
                y={3}
                textAnchor="middle"
                fontSize={9}
                fontWeight={700}
                fill="#0f172a"
                pointerEvents="none"
              >
                {p.name.slice(0, 2).toUpperCase()}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
