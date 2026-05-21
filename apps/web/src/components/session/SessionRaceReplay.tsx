import { useCallback, useEffect, useRef, useState } from "react";

type Racer = {
  participantId: string;
  name: string;
  seconds: number;
};

type Props = {
  racers: Racer[]; // expected sorted fastest-first; we sort defensively
  onSelect?: (participantId: string) => void;
};

type SpeedOption = 1 | 2 | 4;

const COLORS = [
  "#facc15", // gold
  "#94a3b8", // silver
  "#fdba74", // bronze
  "#60a5fa",
  "#34d399",
  "#f472b6",
  "#a78bfa",
  "#fb923c",
  "#22d3ee",
  "#f87171",
];

/* ---------- Web Audio helpers ---------- */

type Audio = {
  ctx: AudioContext;
  master: GainNode;
};

function createAudio(): Audio | null {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0.4;
    master.connect(ctx.destination);
    return { ctx, master };
  } catch {
    return null;
  }
}

/** Short glug/pop sound — used to mark progress while bars are running. */
function playGlug(audio: Audio, t: number) {
  const { ctx, master } = audio;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 800;
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.18);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.4, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + 0.25);
}

/** Crowd cheer — filtered noise burst with envelope. */
function playCheer(audio: Audio) {
  const { ctx, master } = audio;
  const t = ctx.currentTime;
  const dur = 1.6;
  const bufferSize = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    // pink-ish noise (cheap)
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1400;
  bp.Q.value = 0.8;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.7, t + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  // a little high-pitched "whoo" tone on top
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(660, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.4);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.0001, t);
  oscGain.gain.exponentialRampToValueAtTime(0.18, t + 0.1);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);

  src.connect(bp);
  bp.connect(gain);
  gain.connect(master);
  osc.connect(oscGain);
  oscGain.connect(master);

  src.start(t);
  src.stop(t + dur);
  osc.start(t);
  osc.stop(t + dur);
}

/** Tiny "ding" each time someone finishes. */
function playDing(audio: Audio) {
  const { ctx, master } = audio;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1320, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.4);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + 0.55);
}

/* ---------- Component ---------- */

export function SessionRaceReplay({ racers, onSelect }: Props) {
  const sorted = [...racers].sort((a, b) => a.seconds - b.seconds);
  const maxTime = sorted.length > 0 ? sorted[sorted.length - 1].seconds : 0;

  const [expanded, setExpanded] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // simulation seconds (1x scale)
  const [speed, setSpeed] = useState<SpeedOption>(1);
  const [soundOn, setSoundOn] = useState(true);

  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const audioRef = useRef<Audio | null>(null);
  const finishedRef = useRef<Set<string>>(new Set());
  const lastGlugAtRef = useRef<number>(0);
  const firstFinishPlayedRef = useRef<boolean>(false);

  const stopAnimation = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setRunning(false);
  }, []);

  const tick = useCallback(
    (now: number) => {
      const simElapsed = ((now - startRef.current) / 1000) * speed;
      const clamped = Math.min(simElapsed, maxTime);
      setElapsed(clamped);

      // Glug every ~250ms while anyone is still chugging
      if (
        audioRef.current &&
        soundOn &&
        finishedRef.current.size < sorted.length &&
        now - lastGlugAtRef.current > 240
      ) {
        playGlug(audioRef.current, audioRef.current.ctx.currentTime);
        lastGlugAtRef.current = now;
      }

      // Detect finishes
      for (const r of sorted) {
        if (
          clamped >= r.seconds &&
          !finishedRef.current.has(r.participantId)
        ) {
          finishedRef.current.add(r.participantId);
          if (audioRef.current && soundOn) {
            playDing(audioRef.current);
            if (!firstFinishPlayedRef.current) {
              firstFinishPlayedRef.current = true;
              playCheer(audioRef.current);
            }
          }
        }
      }

      if (clamped >= maxTime) {
        stopAnimation();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [maxTime, sorted, soundOn, speed, stopAnimation]
  );

  const start = useCallback(() => {
    if (running || sorted.length === 0) return;
    setExpanded(true);
    finishedRef.current = new Set();
    firstFinishPlayedRef.current = false;
    lastGlugAtRef.current = 0;
    setElapsed(0);

    if (soundOn && !audioRef.current) {
      audioRef.current = createAudio();
    }
    if (audioRef.current && audioRef.current.ctx.state === "suspended") {
      void audioRef.current.ctx.resume();
    }

    startRef.current = performance.now();
    setRunning(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [running, sorted.length, soundOn, tick]);

  const reset = useCallback(() => {
    stopAnimation();
    finishedRef.current = new Set();
    firstFinishPlayedRef.current = false;
    setElapsed(0);
  }, [stopAnimation]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) {
        try {
          void audioRef.current.ctx.close();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  if (sorted.length === 0) return null;

  if (!expanded) {
    return (
      <button
        type="button"
        className="session-race-trigger"
        onClick={start}
        aria-label="Kjør løpet — sanntids-replay"
      >
        <span className="session-race-trigger__icon" aria-hidden="true">▶</span>
        <span className="session-race-trigger__text">
          <span className="session-race-trigger__title">Kjør løpet</span>
          <span className="session-race-trigger__sub">
            Se {sorted.length} chuggere kappes i sanntid — raskest på {sorted[0].seconds.toFixed(2)}s, tregest på {maxTime.toFixed(2)}s
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="card session-race">
      <div className="session-race__head">
        <div>
          <h2 className="session-race__title">🏁 Kjør løpet</h2>
          <p className="session-race__desc">
            Sanntids-replay — den raskeste er ferdig på{" "}
            <strong>{sorted[0].seconds.toFixed(2)}s</strong>, den tregeste på{" "}
            <strong>{maxTime.toFixed(2)}s</strong>.
          </p>
        </div>
        <div className="session-race__controls">
          {!running ? (
            <button
              type="button"
              className="btn session-race__play"
              onClick={start}
            >
              {elapsed > 0 ? "↻ Spill igjen" : "▶ Start"}
            </button>
          ) : (
            <button
              type="button"
              className="btn session-race__stop"
              onClick={reset}
            >
              ■ Stopp
            </button>
          )}
          <div className="session-race__speed" role="group" aria-label="Hastighet">
            {([1, 2, 4] as SpeedOption[]).map((s) => (
              <button
                key={s}
                type="button"
                className={`session-race__speed-btn ${
                  speed === s ? "session-race__speed-btn--active" : ""
                }`}
                onClick={() => setSpeed(s)}
                disabled={running}
              >
                {s}×
              </button>
            ))}
          </div>
          <button
            type="button"
            className="session-race__sound"
            onClick={() => setSoundOn((v) => !v)}
            title={soundOn ? "Demp lyd" : "Slå på lyd"}
            aria-label={soundOn ? "Demp lyd" : "Slå på lyd"}
          >
            {soundOn ? "🔊" : "🔇"}
          </button>
          <button
            type="button"
            className="session-race__collapse"
            onClick={() => {
              reset();
              setExpanded(false);
            }}
            title="Skjul"
            aria-label="Skjul løpet"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="session-race__timer">
        <span className="session-race__timer-value">
          {elapsed.toFixed(2)}s
        </span>
        <span className="session-race__timer-max">
          / {maxTime.toFixed(2)}s
        </span>
      </div>

      <ol className="session-race__list">
        {sorted.map((r, i) => {
          const done = elapsed >= r.seconds;
          const pct = Math.min(100, (elapsed / r.seconds) * 100);
          const displayTime = done ? r.seconds : Math.min(elapsed, r.seconds);
          const color = COLORS[i % COLORS.length];
          return (
            <li
              key={r.participantId}
              className={`session-race__row ${
                done ? "session-race__row--done" : ""
              }`}
            >
              <div className="session-race__rank">{i + 1}</div>
              <button
                type="button"
                className="session-race__name"
                onClick={() => onSelect?.(r.participantId)}
              >
                {r.name}
              </button>
              <div className="session-race__track">
                <div
                  className="session-race__fill"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                  }}
                />
                {done && (
                  <span className="session-race__flag" aria-hidden="true">
                    🏁
                  </span>
                )}
              </div>
              <div className="session-race__time">
                {displayTime.toFixed(2)}s
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
