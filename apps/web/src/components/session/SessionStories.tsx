import { useEffect, useRef, useState } from "react";

export type Story = {
  id: string;
  kind: "title" | "stat" | "award" | "shame" | "wrap";
  emoji?: string;
  heading: string;
  big?: string;
  sub?: string;
  meta?: string;
  background?: string;
};

type Props = {
  stories: Story[];
  onClose: () => void;
};

const DURATION = 4200;

export function SessionStories({ stories, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const startedAt = useRef<number>(performance.now());
  const elapsedBeforePause = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);

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
      const p = Math.min(1, elapsed / DURATION);
      setProgress(p);
      if (p >= 1) {
        if (index < stories.length - 1) {
          setIndex((i) => i + 1);
        } else {
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
  }, [index, stories.length]);

  // Pause/resume timer bookkeeping
  useEffect(() => {
    if (paused) {
      elapsedBeforePause.current += performance.now() - startedAt.current;
    } else {
      startedAt.current = performance.now();
    }
  }, [paused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(stories.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, stories.length]);

  const story = stories[index];
  if (!story) return null;

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () =>
    index < stories.length - 1 ? setIndex((i) => i + 1) : onClose();

  return (
    <div
      className="session-stories"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerCancel={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      <div className="session-stories__bars">
        {stories.map((_, i) => (
          <div key={i} className="session-stories__bar">
            <div
              className="session-stories__bar-fill"
              style={{
                width:
                  i < index ? "100%" : i === index ? `${progress * 100}%` : "0%",
              }}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        className="session-stories__close"
        onClick={onClose}
        aria-label="Lukk"
      >
        ✕
      </button>

      <div
        className={`session-stories__card session-stories__card--${story.kind}`}
        style={story.background ? { background: story.background } : undefined}
      >
        {story.emoji && (
          <div className="session-stories__emoji">{story.emoji}</div>
        )}
        <div className="session-stories__heading">{story.heading}</div>
        {story.big && <div className="session-stories__big">{story.big}</div>}
        {story.sub && <div className="session-stories__sub">{story.sub}</div>}
        {story.meta && <div className="session-stories__meta">{story.meta}</div>}
      </div>

      <button
        type="button"
        className="session-stories__tap session-stories__tap--left"
        onClick={goPrev}
        aria-label="Forrige"
      />
      <button
        type="button"
        className="session-stories__tap session-stories__tap--right"
        onClick={goNext}
        aria-label="Neste"
      />
    </div>
  );
}
