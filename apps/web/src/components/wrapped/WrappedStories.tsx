import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";

export type WrappedCard = {
  id: string;
  /** CSS background (gradient) for the card. */
  bg: string;
  accent?: string;
  /** Fire a confetti burst when this card becomes active. */
  confetti?: boolean;
  kicker?: string;
  emoji?: string;
  heading?: string;
  /** Static big value. Ignored if bigCountUp is set. */
  big?: string;
  /** Animate a number counting up to this value when the card opens. */
  bigCountUp?: number;
  bigDecimals?: number;
  bigPrefix?: string;
  bigSuffix?: string;
  sub?: string;
  meta?: string;
  /** Custom content rendered below the heading (podiums, lists, charts…). */
  content?: React.ReactNode;
  /** Per-card duration override (ms). */
  durationMs?: number;
};

type Props = {
  cards: WrappedCard[];
  onClose: () => void;
  playSong?: boolean;
};

const DEFAULT_DURATION = 5200;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf = 0;
    const duration = 1300;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(value * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <>
      {prefix}
      {display.toLocaleString("nb-NO", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </>
  );
}

export function WrappedStories({ cards, onClose, playSong }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const startedAt = useRef<number>(performance.now());
  const elapsedBeforePause = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);

  const card = cards[index];
  const duration = card?.durationMs ?? DEFAULT_DURATION;

  // Auto-advance timer
  useEffect(() => {
    startedAt.current = performance.now();
    elapsedBeforePause.current = 0;
    setProgress(0);

    const tick = (now: number) => {
      if (paused) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const elapsed = elapsedBeforePause.current + (now - startedAt.current);
      const p = Math.min(1, elapsed / duration);
      setProgress(p);
      if (p >= 1) {
        if (index < cards.length - 1) setIndex((i) => i + 1);
        else {
          onClose();
          return;
        }
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, cards.length, duration]);

  // Pause bookkeeping
  useEffect(() => {
    if (paused) elapsedBeforePause.current += performance.now() - startedAt.current;
    else startedAt.current = performance.now();
  }, [paused]);

  // Confetti on entering a celebratory card
  useEffect(() => {
    if (!card?.confetti) return;
    const colors = ["#facc15", "#f97316", "#ef4444", "#10b981", "#3b82f6", "#a855f7"];
    const end = Date.now() + 1400;
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 75, origin: { x: 0, y: 0.65 }, colors });
      confetti({ particleCount: 5, angle: 120, spread: 75, origin: { x: 1, y: 0.65 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [index, card?.confetti]);

  // Song
  useEffect(() => {
    if (!playSong) return;
    const audio = new Audio("/DenSisteChuggen.wav");
    audio.volume = 0.55;
    audio.loop = true;
    audioRef.current = audio;
    audio.play().catch(() => {
      /* autoplay may be blocked until first interaction */
    });
    return () => {
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, [playSong]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(cards.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, cards.length]);

  if (!card) return null;

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => (index < cards.length - 1 ? setIndex((i) => i + 1) : onClose());

  return (
    <div className="wrapped-stories">
      <div className="wrapped-stories__bars">
        {cards.map((_, i) => (
          <div key={i} className="wrapped-stories__bar">
            <div
              className="wrapped-stories__bar-fill"
              style={{ width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      <div className="wrapped-stories__topbar">
        <span className="wrapped-stories__brand">GROTTECHUG · WRAPPED</span>
        <div className="wrapped-stories__top-actions">
          {playSong && (
            <button
              type="button"
              className="wrapped-stories__icon-btn"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? "Slå på lyd" : "Demp lyd"}
              title={muted ? "Slå på lyd" : "Demp lyd"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
          )}
          <button
            type="button"
            className="wrapped-stories__icon-btn"
            onClick={onClose}
            aria-label="Lukk"
          >
            ✕
          </button>
        </div>
      </div>

      <div
        className="wrapped-stories__stage"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
      >
        <button
          type="button"
          className="wrapped-stories__tap wrapped-stories__tap--left"
          onClick={goPrev}
          aria-label="Forrige"
        />
        <button
          type="button"
          className="wrapped-stories__tap wrapped-stories__tap--right"
          onClick={goNext}
          aria-label="Neste"
        />

        <div
          key={card.id}
          className="wrapped-stories__card"
          style={{ background: card.bg, ...(card.accent ? { ["--wrap-accent" as string]: card.accent } : {}) }}
        >
          <div className="wrapped-stories__card-inner">
            {card.kicker && <div className="wrapped-stories__kicker">{card.kicker}</div>}
            {card.emoji && <div className="wrapped-stories__emoji">{card.emoji}</div>}
            {card.heading && <div className="wrapped-stories__heading">{card.heading}</div>}
            {(card.big != null || card.bigCountUp != null) && (
              <div className="wrapped-stories__big">
                {card.bigCountUp != null ? (
                  <CountUp
                    value={card.bigCountUp}
                    decimals={card.bigDecimals ?? 0}
                    prefix={card.bigPrefix ?? ""}
                    suffix={card.bigSuffix ?? ""}
                  />
                ) : (
                  card.big
                )}
              </div>
            )}
            {card.content && <div className="wrapped-stories__content">{card.content}</div>}
            {card.sub && <div className="wrapped-stories__sub">{card.sub}</div>}
            {card.meta && <div className="wrapped-stories__meta">{card.meta}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
