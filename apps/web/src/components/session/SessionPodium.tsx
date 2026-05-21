import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

type Entry = {
  participantId: string;
  name: string;
  seconds: number;
};

type Props = {
  top3: Entry[]; // sorted fastest first
  onSelect: (participantId: string) => void;
  /** True if today's fastest is an all-time record (fires confetti). */
  isRecord?: boolean;
};

export function SessionPodium({ top3, onSelect, isRecord }: Props) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (!isRecord) return;
    firedRef.current = true;
    const duration = 1800;
    const end = Date.now() + duration;
    const colors = ["#facc15", "#f97316", "#ef4444", "#10b981", "#3b82f6"];
    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 70,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 70,
        origin: { x: 1, y: 0.7 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [isRecord]);

  if (top3.length === 0) return null;

  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  return (
    <div className="card session-podium">
      <div className="session-podium__head">
        <h2 className="session-podium__title">🏆 Dagens pall</h2>
        {isRecord && (
          <span className="session-podium__record">All-time rekord!</span>
        )}
      </div>

      <div className="session-podium__stage">
        {/* 2nd place — left */}
        {second && (
          <PodiumColumn
            place={2}
            entry={second}
            onSelect={onSelect}
            modifier="silver"
          />
        )}

        {/* 1st place — center */}
        <PodiumColumn
          place={1}
          entry={first}
          onSelect={onSelect}
          modifier="gold"
        />

        {/* 3rd place — right */}
        {third && (
          <PodiumColumn
            place={3}
            entry={third}
            onSelect={onSelect}
            modifier="bronze"
          />
        )}
      </div>
    </div>
  );
}

function PodiumColumn({
  place,
  entry,
  onSelect,
  modifier,
}: {
  place: 1 | 2 | 3;
  entry: Entry;
  onSelect: (id: string) => void;
  modifier: "gold" | "silver" | "bronze";
}) {
  const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉";
  return (
    <div className={`session-podium__col session-podium__col--${modifier} session-podium__col--p${place}`}>
      <div className="session-podium__medal">{medal}</div>
      <button
        type="button"
        className="session-podium__name"
        onClick={() => onSelect(entry.participantId)}
        title={entry.name}
      >
        {entry.name}
      </button>
      <div className="session-podium__time">{entry.seconds.toFixed(2)}s</div>
      <div className={`session-podium__block session-podium__block--${modifier}`}>
        <span className="session-podium__block-number">{place}</span>
      </div>
    </div>
  );
}
