import { useMemo, useRef, useEffect } from "react";

type Props = {
  sessions: { id: string; dateISO: string }[];
  sessionAvgs: Record<string, number | null>;
  currentId: string;
  onSelect: (sessionId: string) => void;
};

function fmtShort(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function fmtFull(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function SessionTimeline({ sessions, sessionAvgs, currentId, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  const { sorted, min, max } = useMemo(() => {
    const sortedSessions = [...sessions].sort(
      (a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime()
    );
    const avgs = Object.values(sessionAvgs).filter(
      (v): v is number => typeof v === "number" && v > 0
    );
    return {
      sorted: sortedSessions,
      min: avgs.length ? Math.min(...avgs) : 0,
      max: avgs.length ? Math.max(...avgs) : 1,
    };
  }, [sessions, sessionAvgs]);

  useEffect(() => {
    if (activeRef.current && wrapRef.current) {
      const wrap = wrapRef.current;
      const el = activeRef.current;
      const offset = el.offsetLeft - wrap.clientWidth / 2 + el.clientWidth / 2;
      wrap.scrollTo({ left: offset, behavior: "smooth" });
    }
  }, [currentId, sorted.length]);

  if (sorted.length < 2) return null;

  return (
    <div className="card session-timeline">
      <div className="session-timeline__head">
        <h2 className="session-timeline__title">Reisen så langt</h2>
        <div className="session-timeline__legend">
          <span className="session-timeline__legend-swatch session-timeline__legend-swatch--fast" />
          <span>Raskt snitt</span>
          <span className="session-timeline__legend-swatch session-timeline__legend-swatch--slow" />
          <span>Tregt snitt</span>
        </div>
      </div>

      <div className="session-timeline__strip" ref={wrapRef}>
        {sorted.map((s) => {
          const avg = sessionAvgs[s.id] ?? null;
          const isActive = s.id === currentId;
          const t =
            avg == null || max === min ? 0.5 : (avg - min) / (max - min);
          // 0 = fastest (green/cyan), 1 = slowest (red)
          const hue = Math.round(160 - t * 160); // 160 → 0
          const bg =
            avg == null
              ? "rgba(255,255,255,0.04)"
              : `hsl(${hue}, 70%, ${isActive ? 55 : 40}%)`;

          return (
            <button
              key={s.id}
              ref={isActive ? activeRef : undefined}
              type="button"
              className={`session-timeline__cell ${isActive ? "session-timeline__cell--active" : ""}`}
              onClick={() => !isActive && onSelect(s.id)}
              title={`${fmtFull(s.dateISO)}${avg != null ? ` • snitt ${avg.toFixed(2)}s` : ""}`}
              style={{ background: bg }}
            >
              <span className="session-timeline__cell-date">{fmtShort(s.dateISO)}</span>
              <span className="session-timeline__cell-avg">
                {avg != null ? `${avg.toFixed(1)}s` : "–"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
