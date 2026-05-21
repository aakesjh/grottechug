import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { Avatar } from "./Avatar";

export type LeaderboardPodiumEntry = {
  participantId: string;
  name: string;
  imageUrl?: string | null;
  /** Time shown under the name, in seconds. */
  seconds: number;
};

const MEDAL = ["🥇", "🥈", "🥉"] as const;
const PODIUM_COLORS = [
  { bg: "linear-gradient(180deg, rgba(255,215,0,0.18), rgba(255,215,0,0.06))", border: "#FFD700", glow: "0 0 20px rgba(255,215,0,0.2)" },
  { bg: "linear-gradient(180deg, rgba(192,192,192,0.14), rgba(192,192,192,0.04))", border: "#C0C0C0", glow: "0 0 16px rgba(192,192,192,0.15)" },
  { bg: "linear-gradient(180deg, rgba(205,127,50,0.14), rgba(205,127,50,0.04))", border: "#CD7F32", glow: "0 0 16px rgba(205,127,50,0.15)" },
];
const STAND_HEIGHTS = [100, 72, 52];

type Props = {
  /** Top 3 sorted fastest first. */
  top3: LeaderboardPodiumEntry[];
  /** Optional title shown above the stand. */
  title?: string;
  /** Optional badge shown next to title (e.g. "All-time rekord!"). */
  badge?: string;
  /** When true, fires celebratory confetti once on mount. */
  celebrate?: boolean;
  /** Override avatar/navigation behavior on click. Defaults to navigating to /person/:id. */
  onSelect?: (participantId: string) => void;
};

export function LeaderboardPodium({ top3, title, badge, celebrate, onSelect }: Props) {
  const nav = useNavigate();
  const handleSelect = onSelect ?? ((id: string) => nav(`/person/${id}`));
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (!celebrate) return;
    firedRef.current = true;
    const duration = 1800;
    const end = Date.now() + duration;
    const colors = ["#facc15", "#f97316", "#ef4444", "#10b981", "#3b82f6"];
    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [celebrate]);

  // Display order: 2nd, 1st, 3rd
  const order = [1, 0, 2];
  const slots = order.map((i) => top3[i] ?? null);

  return (
    <div className="leaderboard-podium">
      {(title || badge) && (
        <div className="leaderboard-podium__head">
          {title && <h2 className="leaderboard-podium__title">{title}</h2>}
          {badge && (
            <span className={`leaderboard-podium__badge ${celebrate ? "leaderboard-podium__badge--celebrate" : ""}`}>
              {badge}
            </span>
          )}
        </div>
      )}
      <div className="podium">
        {slots.map((r, idx) => {
          const pos = order[idx];
          const colors = PODIUM_COLORS[pos];
          const standH = STAND_HEIGHTS[pos];

          if (!r) {
            return (
              <div key={pos} className="podium__slot">
                <div className="podium__medal">{MEDAL[pos]}</div>
                <div className="podium__avatar-wrap podium__avatar-wrap--empty">—</div>
                <div className="podium__stand podium__stand--empty" style={{ height: standH }} />
              </div>
            );
          }

          return (
            <button
              key={pos}
              className="podium__slot podium__slot--clickable"
              onClick={() => handleSelect(r.participantId)}
            >
              <div className="podium__medal">{MEDAL[pos]}</div>
              <div
                className="podium__avatar-wrap"
                style={{ borderColor: colors.border, boxShadow: colors.glow }}
              >
                {r.imageUrl
                  ? <img src={r.imageUrl} alt={r.name} className="podium__avatar-img" />
                  : <Avatar name={r.name} size={56} />
                }
              </div>
              <div className="podium__details">
                <div className="podium__name">{r.name}</div>
                <div className="podium__time">{r.seconds.toFixed(2)}s</div>
              </div>
              <div
                className="podium__stand"
                style={{ height: standH, background: colors.bg, borderColor: colors.border }}
              >
                <span className="podium__stand-rank">{pos + 1}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
