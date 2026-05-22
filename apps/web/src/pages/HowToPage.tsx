import { useEffect, useRef, useState } from "react";
import "../styles/pages/howto.css";

/* ──────────────────────────────────────────────────────────────────────────
   1 · Pour into cup
   ─────────────────────────────────────────────────────────────────────── */
function CupPourSVG() {
  return (
    <svg className="howto__illustration" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="howto-pour-liquid" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--accent3) 75%, transparent)" />
          <stop offset="100%" stopColor="color-mix(in srgb, var(--accent3) 30%, transparent)" />
        </linearGradient>
      </defs>

      {/* Beer can held tilted, opening pointing down toward the cup */}
      <g className="howto__pourCan">
        {/* Drawn horizontally then rotated so the opening (right end) points down‑right toward the cup. */}
        <g transform="rotate(58 60 56)">
          <rect x="18" y="38" width="84" height="36" rx="5" fill="color-mix(in srgb, var(--accent3) 18%, transparent)" stroke="var(--accent3)" strokeWidth="2" />
          {/* Closed bottom (left side) */}
          <ellipse cx="18" cy="56" rx="3" ry="18" fill="color-mix(in srgb, var(--accent3) 10%, transparent)" stroke="var(--accent3)" strokeWidth="1.4" />
          {/* Opening rim (right side) */}
          <ellipse cx="102" cy="56" rx="3" ry="18" fill="color-mix(in srgb, var(--accent3) 28%, transparent)" stroke="var(--accent3)" strokeWidth="1.6" />
          {/* Pull-tab on top of body, near the opening */}
          <ellipse cx="94" cy="40" rx="5" ry="2" fill="color-mix(in srgb, var(--accent3) 40%, transparent)" stroke="var(--accent3)" strokeWidth="1" />
          {/* Color band + PILS label */}
          <rect x="34" y="48" width="50" height="16" fill="color-mix(in srgb, var(--accent3) 28%, transparent)" />
          <text x="59" y="60" textAnchor="middle" fill="color-mix(in srgb, var(--accent3) 95%, var(--text))" fontSize="10" fontWeight="800" letterSpacing="1.5">PILS</text>
        </g>
      </g>

      {/* Stream falls from the opening (~96, 96 after rotation) into the cup */}
      <path className="howto__pourRibbon" d="M96 96 Q102 110 107 122" stroke="url(#howto-pour-liquid)" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path className="howto__pourRibbon howto__pourRibbon--inner" d="M98 96 Q103 110 108 122" stroke="color-mix(in srgb, var(--accent3) 60%, transparent)" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* Splash */}
      <circle className="howto__pourBubble howto__pourBubble--1" cx="96" cy="92" r="2.8" fill="color-mix(in srgb, var(--accent3) 55%, transparent)" />
      <circle className="howto__pourBubble howto__pourBubble--2" cx="106" cy="86" r="2" fill="color-mix(in srgb, var(--accent3) 45%, transparent)" />
      <circle className="howto__pourBubble howto__pourBubble--3" cx="100" cy="96" r="2.3" fill="color-mix(in srgb, var(--accent3) 50%, transparent)" />
      <circle className="howto__pourBubble howto__pourBubble--4" cx="112" cy="92" r="1.4" fill="color-mix(in srgb, var(--accent3) 40%, transparent)" />

      {/* Cup */}
      <path d="M85 104 L90 162 L130 162 L135 104 Z" fill="color-mix(in srgb, var(--accent) 12%, transparent)" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M86.5 110 Q98 106 110 110 Q122 114 133.5 110" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path className="howto__pourFill" d="M89 124 L91 160 L129 160 L131 124 Z" fill="url(#howto-pour-liquid)" />
      <circle className="howto__cupBubble howto__cupBubble--1" cx="100" cy="150" r="1.4" fill="rgba(255,255,255,0.55)" />
      <circle className="howto__cupBubble howto__cupBubble--2" cx="112" cy="148" r="1.1" fill="rgba(255,255,255,0.45)" />
      <circle className="howto__cupBubble howto__cupBubble--3" cx="120" cy="152" r="1.2" fill="rgba(255,255,255,0.5)" />
      <text x="110" y="148" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="9" fontWeight="700" letterSpacing="0.5">0.5L</text>
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   2 · Wheel — spins around its own center
   ─────────────────────────────────────────────────────────────────────── */
function WheelSVG() {
  // Wheel centered at (100, 90). Wedge geometry is generated in absolute coords.
  const cx = 100;
  const cy = 90;
  const r = 54;
  const wedges = [
    "var(--accent2)", "var(--accent3)", "var(--accent4)", "var(--accent2)",
    "var(--accent3)", "var(--accent)", "var(--accent4)", "var(--accent2)",
  ];

  return (
    <svg className="howto__illustration" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="howto-wheel-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--accent2) 25%, transparent)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={68} fill="url(#howto-wheel-glow)" />

      <g className="howto__wheelSpin" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <circle cx={cx} cy={cy} r={r} fill="color-mix(in srgb, var(--accent) 8%, transparent)" stroke="color-mix(in srgb, var(--accent2) 70%, var(--border))" strokeWidth="2" />
        {wedges.map((c, i) => {
          const a0 = (i * 360) / wedges.length - 90;
          const a1 = ((i + 1) * 360) / wedges.length - 90;
          const x0 = cx + Math.cos((a0 * Math.PI) / 180) * r;
          const y0 = cy + Math.sin((a0 * Math.PI) / 180) * r;
          const x1 = cx + Math.cos((a1 * Math.PI) / 180) * r;
          const y1 = cy + Math.sin((a1 * Math.PI) / 180) * r;
          return (
            <path
              key={i}
              d={`M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`}
              fill={`color-mix(in srgb, ${c} 28%, transparent)`}
              stroke="color-mix(in srgb, var(--accent2) 35%, transparent)"
              strokeWidth="1.1"
            />
          );
        })}
        <circle cx={cx} cy={cy} r={14} fill="color-mix(in srgb, var(--accent2) 30%, var(--card-bg))" stroke="var(--accent2)" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={5} fill="var(--text)" />
      </g>

      {/* Pointer */}
      <g className="howto__wheelPointer">
        <path d="M148 90 L168 80 L168 100 Z" fill="var(--danger)" stroke="color-mix(in srgb, var(--danger) 60%, var(--bg))" strokeWidth="1" strokeLinejoin="round" />
        <circle cx="168" cy="90" r="3" fill="var(--danger)" />
      </g>

      <text x="100" y="170" textAnchor="middle" fill="var(--muted)" fontSize="9" fontWeight="700" letterSpacing="1.2">VENT PÅ TUR</text>
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Reusable person primitives
   ─────────────────────────────────────────────────────────────────────── */
function Head({
  cx,
  cy,
  r = 12,
  hair = true,
  expression = "neutral",
}: {
  cx: number;
  cy: number;
  r?: number;
  hair?: boolean;
  expression?: "neutral" | "focused" | "happy" | "puff" | "drinking";
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="color-mix(in srgb, var(--accent2) 22%, var(--card-bg))" stroke="var(--accent2)" strokeWidth="2.2" />
      {hair && (
        <path
          d={`M ${cx - r * 0.7} ${cy - r * 0.55} Q ${cx} ${cy - r * 1.25} ${cx + r * 0.85} ${cy - r * 0.4}`}
          stroke="var(--accent2)"
          strokeWidth="2.5"
          fill="color-mix(in srgb, var(--accent2) 45%, transparent)"
          strokeLinecap="round"
        />
      )}
      {expression === "neutral" && (
        <>
          <circle cx={cx - r * 0.32} cy={cy - r * 0.1} r={1.4} fill="var(--text)" />
          <circle cx={cx + r * 0.32} cy={cy - r * 0.1} r={1.4} fill="var(--text)" />
          <path d={`M ${cx - r * 0.3} ${cy + r * 0.45} Q ${cx} ${cy + r * 0.55} ${cx + r * 0.3} ${cy + r * 0.45}`} stroke="var(--text)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </>
      )}
      {expression === "focused" && (
        <>
          <path d={`M ${cx - r * 0.5} ${cy - r * 0.25} L ${cx - r * 0.15} ${cy - r * 0.1}`} stroke="var(--text)" strokeWidth="1.8" strokeLinecap="round" />
          <path d={`M ${cx + r * 0.15} ${cy - r * 0.1} L ${cx + r * 0.5} ${cy - r * 0.25}`} stroke="var(--text)" strokeWidth="1.8" strokeLinecap="round" />
          <line x1={cx - r * 0.3} y1={cy + r * 0.45} x2={cx + r * 0.3} y2={cy + r * 0.45} stroke="var(--text)" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )}
      {expression === "happy" && (
        <>
          <circle cx={cx - r * 0.32} cy={cy - r * 0.1} r={1.4} fill="var(--text)" />
          <circle cx={cx + r * 0.32} cy={cy - r * 0.1} r={1.4} fill="var(--text)" />
          <path d={`M ${cx - r * 0.4} ${cy + r * 0.3} Q ${cx} ${cy + r * 0.75} ${cx + r * 0.4} ${cy + r * 0.3}`} stroke="var(--text)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </>
      )}
      {expression === "puff" && (
        <>
          <path d={`M ${cx - r * 0.5} ${cy - r * 0.2} L ${cx - r * 0.15} ${cy - r * 0.05}`} stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />
          <path d={`M ${cx + r * 0.15} ${cy - r * 0.05} L ${cx + r * 0.5} ${cy - r * 0.2}`} stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />
          <path d={`M ${cx - r * 0.3} ${cy + r * 0.5} Q ${cx} ${cy + r * 0.4} ${cx + r * 0.3} ${cy + r * 0.5}`} stroke="var(--text)" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      )}
      {expression === "drinking" && (
        <path d={`M ${cx - r * 0.25} ${cy - r * 0.1} Q ${cx} ${cy - r * 0.25} ${cx + r * 0.25} ${cy - r * 0.1}`} stroke="var(--text)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      )}
    </g>
  );
}

function Limb({ x1, y1, x2, y2, w = 3 }: { x1: number; y1: number; x2: number; y2: number; w?: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--accent2)" strokeWidth={w} strokeLinecap="round" />;
}

/* Shared counter for steps 3-6 (top edge at y=120) */
function Counter() {
  return (
    <>
      <rect x="8" y="120" width="184" height="10" rx="3" fill="color-mix(in srgb, var(--border) 80%, var(--text))" />
      <rect x="8" y="130" width="184" height="3" fill="rgba(0,0,0,0.25)" />
    </>
  );
}

/* Shared kneeling pose: spine + legs only. Head at (56, 102), shoulder at (62, 122). */
function KneelingBody() {
  return (
    <>
      {/* Curved spine, shoulder at (62, 122) */}
      <path d="M56 114 Q60 130 66 150" stroke="var(--accent2)" strokeWidth="3.6" fill="none" strokeLinecap="round" />
      {/* Front thigh + shin, knee on the ground */}
      <Limb x1={66} y1={150} x2={50} y2={162} w={3.4} />
      <Limb x1={50} y1={162} x2={38} y2={164} w={3} />
      {/* Back thigh + foot */}
      <Limb x1={66} y1={150} x2={86} y2={162} w={3.4} />
      <Limb x1={86} y1={162} x2={96} y2={166} w={3} />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   3 · Ready at counter — kneeling, hand resting near cup on counter
   ─────────────────────────────────────────────────────────────────────── */
function KneelSVG() {
  return (
    <svg className="howto__illustration" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Counter />

      {/* Cup sitting on counter at right */}
      <g className="howto__kneelCup">
        <path d="M118 100 L120 120 L146 120 L148 100 Z" fill="color-mix(in srgb, var(--accent) 14%, transparent)" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M121 108 L122.5 119 L143.5 119 L145 108 Z" fill="color-mix(in srgb, var(--accent3) 32%, transparent)" />
        <path d="M120 106 Q130 103 140 106 Q145 107 146.5 108" stroke="rgba(255,255,255,0.45)" strokeWidth="1" fill="none" strokeLinecap="round" />
      </g>

      <g className="howto__kneelPerson">
        <Head cx={56} cy={102} r={12} expression="neutral" />
        <KneelingBody />
        {/* Back arm relaxed */}
        <Limb x1={60} y1={122} x2={44} y2={140} w={3} />
        {/* Front arm extending toward cup on counter */}
        <Limb x1={62} y1={122} x2={84} y2={118} w={3} />
        <Limb x1={84} y1={118} x2={104} y2={112} w={3} />
        <circle cx={104} cy={112} r={2.6} fill="var(--accent2)" />
      </g>

      <ellipse className="howto__shadow" cx="66" cy="170" rx="38" ry="2.5" fill="rgba(0,0,0,0.35)" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   4 · Drinking — same kneel pose, head tilted back, cup raised to mouth
   ─────────────────────────────────────────────────────────────────────── */
function DrinkSVG() {
  return (
    <svg className="howto__illustration" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Counter />

      {/* Stopwatch (START) */}
      <g transform="translate(165 60)">
        <circle r="22" fill="color-mix(in srgb, var(--accent) 10%, var(--card-bg))" stroke="var(--accent)" strokeWidth="1.8" />
        <rect x="-3" y="-26" width="6" height="5" rx="1" fill="var(--accent)" />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <line key={a} x1="0" y1="-18" x2="0" y2="-15" stroke="var(--accent)" strokeWidth="1.2" transform={`rotate(${a})`} />
        ))}
        <g className="howto__drinkTimerHand">
          <line x1="0" y1="2" x2="0" y2="-15" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        </g>
        <circle r="2.5" fill="var(--accent)" />
        <text y="40" textAnchor="middle" fill="var(--accent)" fontSize="9" fontWeight="800" letterSpacing="1.2">START</text>
      </g>

      <g className="howto__drinkPerson">
        <KneelingBody />

        {/* Head tilted back */}
        <g transform="rotate(-22 56 102)">
          <Head cx={56} cy={102} r={12} expression="drinking" />
        </g>

        {/* Cup raised to mouth, tilted to pour */}
        <g transform="rotate(-95 70 88)">
          <path d="M62 70 L66 108 L84 108 L80 70 Z" fill="color-mix(in srgb, var(--accent) 14%, var(--card-bg))" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" />
          <path className="howto__drinkLiquid" d="M65 76 L67 107 L83 107 L81 76 Z" fill="color-mix(in srgb, var(--accent3) 45%, transparent)" />
        </g>

        {/* Stream from cup to mouth */}
        <path className="howto__drinkStream" d="M62 82 Q58 90 56 96" stroke="var(--accent3)" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* Front arm raised holding cup */}
        <Limb x1={62} y1={122} x2={74} y2={104} w={3} />
        <Limb x1={74} y1={104} x2={70} y2={88} w={3} />
        {/* Back arm bracing cup */}
        <Limb x1={60} y1={122} x2={50} y2={102} w={3} />
        <Limb x1={50} y1={102} x2={62} y2={88} w={3} />
      </g>

      {/* Throat gulp */}
      <path className="howto__gulp" d="M58 120 Q58 126 56 132" stroke="color-mix(in srgb, var(--accent3) 70%, transparent)" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      <ellipse className="howto__shadow" cx="66" cy="170" rx="38" ry="2.5" fill="rgba(0,0,0,0.35)" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   5 · Keep liquid inside — puffed cheeks, cup held at chest
   ─────────────────────────────────────────────────────────────────────── */
function KeepInsideSVG() {
  return (
    <svg className="howto__illustration" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Counter />

      {/* Warning bubble */}
      <g transform="translate(160 30)">
        <circle r="12" fill="color-mix(in srgb, var(--danger) 14%, transparent)" stroke="var(--danger)" strokeWidth="1.6" />
        <path d="M-5 -5 L5 5 M5 -5 L-5 5" stroke="var(--danger)" strokeWidth="2.4" strokeLinecap="round" />
        <text y="26" textAnchor="middle" fill="var(--danger)" fontSize="8" fontWeight="800" letterSpacing="0.8">SØL</text>
      </g>

      {/* Approval bubble */}
      <g transform="translate(190 30)">
        <circle r="12" fill="color-mix(in srgb, #10b981 14%, transparent)" stroke="#10b981" strokeWidth="1.6" />
        <path className="howto__checkMark" d="M-5 0 L-1 4 L6 -4" stroke="#10b981" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <text y="26" textAnchor="middle" fill="#10b981" fontSize="8" fontWeight="800" letterSpacing="0.8">BRA</text>
      </g>

      <g className="howto__keepPerson">
        <Head cx={56} cy={102} r={12} expression="happy" />
        {/* Puffed cheeks just outside head */}
        <ellipse className="howto__cheek howto__cheek--left" cx="44" cy="105" rx="4.5" ry="3.6" fill="color-mix(in srgb, var(--accent3) 28%, transparent)" stroke="var(--accent3)" strokeWidth="1.3" />
        <ellipse className="howto__cheek howto__cheek--right" cx="68" cy="105" rx="4.5" ry="3.6" fill="color-mix(in srgb, var(--accent3) 28%, transparent)" stroke="var(--accent3)" strokeWidth="1.3" />

        <KneelingBody />

        {/* Cup held in front (between hands), above counter */}
        <path d="M82 104 L84 118 L102 118 L104 104 Z" fill="color-mix(in srgb, var(--accent) 14%, transparent)" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M84 110 L85 117 L101 117 L102 110 Z" fill="color-mix(in srgb, var(--accent3) 35%, transparent)" />

        {/* Both arms holding cup */}
        <Limb x1={62} y1={122} x2={82} y2={112} w={3} />
        <Limb x1={60} y1={122} x2={82} y2={120} w={3} />
      </g>

      <ellipse className="howto__shadow" cx="66" cy="170" rx="38" ry="2.5" fill="rgba(0,0,0,0.35)" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   6 · Slam cup on counter — same kneel pose, front arm swings down
   ─────────────────────────────────────────────────────────────────────── */
function CupDownSVG() {
  return (
    <svg className="howto__illustration" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <Counter />

      {/* Impact lines around the cup landing point (110, 120) */}
      <g className="howto__impactBurst">
        <line x1="110" y1="110" x2="110" y2="94" stroke="var(--accent3)" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="96" y1="114" x2="84" y2="102" stroke="var(--accent3)" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="124" y1="114" x2="136" y2="102" stroke="var(--accent3)" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="92" y1="122" x2="78" y2="120" stroke="var(--accent3)" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="128" y1="122" x2="142" y2="120" stroke="var(--accent3)" strokeWidth="2.2" strokeLinecap="round" />
      </g>

      <g className="howto__slamPerson">
        <Head cx={56} cy={102} r={12} expression="happy" />
        <KneelingBody />
        {/* Back arm out for balance */}
        <Limb x1={60} y1={122} x2={42} y2={140} w={3} />

        {/* Slamming arm + cup — rotates around front shoulder (62, 122) */}
        <g className="howto__slamArm">
          <Limb x1={62} y1={122} x2={82} y2={118} w={3} />
          <Limb x1={82} y1={118} x2={104} y2={112} w={3} />
          <circle cx={104} cy={112} r={3} fill="var(--accent2)" />
          {/* Cup, hand grips top rim */}
          <path d="M96 100 L98 120 L122 120 L124 100 Z" fill="color-mix(in srgb, var(--accent) 16%, transparent)" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" />
          <line x1="104" y1="104" x2="104" y2="116" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" />
          {/* Last drops */}
          <ellipse cx="110" cy="118" rx="7" ry="1.4" fill="color-mix(in srgb, var(--accent3) 30%, transparent)" />
        </g>
      </g>

      {/* Stopwatch — STOP (wrapper preserves translate when CSS animates scale) */}
      <g transform="translate(165 60)">
        <g className="howto__stopWatch">
          <circle r="22" fill="color-mix(in srgb, var(--danger) 12%, var(--card-bg))" stroke="var(--danger)" strokeWidth="1.8" />
          <rect x="-3" y="-26" width="6" height="5" rx="1" fill="var(--danger)" />
          <rect x="-7" y="-7" width="14" height="14" rx="2" fill="var(--danger)" />
          <text y="40" textAnchor="middle" fill="var(--danger)" fontSize="9" fontWeight="800" letterSpacing="1.2">STOPP</text>
        </g>
      </g>

      {/* Note */}
      <text x="100" y="176" textAnchor="middle" fill="var(--muted)" fontSize="9" fontWeight="600">t = (t₁ + t₂) / 2</text>

      <ellipse className="howto__shadow" cx="66" cy="170" rx="38" ry="2.5" fill="rgba(0,0,0,0.35)" />
    </svg>
  );
}

const steps = [
  {
    number: 1,
    title: "Hell i koppen",
    description: "Hell drikken din i en 0.5-liters plastkopp.",
    tip: "Hell hardt og tidlig.  Det reduserer kullsyren og gjør chuggingen lettere.",
    Illustration: CupPourSVG,
    accent: "orange",
  },
  {
    number: 2,
    title: "Vent på tur",
    description: "Hjulet bestemmer rekkefølgen, så vent til det er din tur.",
    tip: null,
    Illustration: WheelSVG,
    accent: "purple",
  },
  {
    number: 3,
    title: "Klar ved disken",
    description: "Still deg klar ved disken med koppen. Sjekk at tidtakerne er klare.",
    tip: "Står du på knær vil avstanden fra munnen til bordet bli kortere etterpå.",
    Illustration: KneelSVG,
    accent: "cyan",
  },
  {
    number: 4,
    title: "Start chuggingen",
    description: "Sett koppen til munnen og begynn å drikke. Timeren starter når første dråpe treffer leppene dine.",
    tip: null,
    Illustration: DrinkSVG,
    accent: "purple",
  },
  {
    number: 5,
    title: "Hold alt inni munnen",
    description: "Drikk til du er ferdig. Hold så mye som mulig inni munnen for å unngå anmerkninger.",
    tip: "Søl = kryss! Hold leppene tett rundt koppen",
    Illustration: KeepInsideSVG,
    accent: "pink",
  },
  {
    number: 6,
    title: "Sett ned koppen",
    description: "Når du er ferdig, sett koppen tilbake på disken. Timeren stopper når koppen treffer disken.",
    tip: "Du kan sette ned koppen selv om du ikke har svelget all drikken. Tiden din blir gjennomsnittet av (minst) to målte tider.",
    Illustration: CupDownSVG,
    accent: "green",
  },
];

const accentColors: Record<string, string> = {
  orange: "var(--accent3)",
  cyan: "var(--accent2)",
  purple: "var(--accent)",
  pink: "var(--accent4)",
  green: "#10b981",
};

export function HowToPage() {
  const [activeStep, setActiveStep] = useState(1);
  const [scrollProgress, setScrollProgress] = useState(0);
  const stepsWrapRef = useRef<HTMLDivElement | null>(null);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const nodes = stepRefs.current.filter((node): node is HTMLDivElement => Boolean(node));
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (!visible) return;
        const idx = nodes.indexOf(visible.target as HTMLDivElement);
        if (idx >= 0) setActiveStep(idx + 1);
      },
      { threshold: 0.1 },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const nodes = stepRefs.current.filter((node): node is HTMLDivElement => Boolean(node));
      if (!nodes.length) return;

      const visibleStep = nodes.find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.top <= window.innerHeight * 0.5 && rect.bottom > window.innerHeight * 0.5;
      });

      if (!visibleStep) return;

      const stepRect = visibleStep.getBoundingClientRect();
      const stepTop = stepRect.top;
      const stepProgress = (-stepTop) / window.innerHeight;
      const clamped = Math.max(0, Math.min(1, stepProgress));
      setScrollProgress(clamped);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return (
    <div className="howto">
      <div className="howto__hero">
        <h1 className="howto__title">Slik chugger du</h1>
        <p className="howto__subtitle">Grottechug på 6 enkle steg</p>
      </div>

      <div className="howto__steps" ref={stepsWrapRef}>
        <div className="howto__progressRail" aria-hidden="true">
          <div
            className="howto__progressFill"
            style={{ transform: `scaleY(${scrollProgress})` }}
          />
        </div>

        {steps.map((step, idx) => (
          <div
            key={step.number}
            ref={(node) => {
              stepRefs.current[idx] = node;
            }}
            className={`howto__step ${activeStep === step.number ? "is-active" : ""}`}
            style={{ "--step-accent": accentColors[step.accent] } as React.CSSProperties}
          >
            <div className="howto__step-badge">{step.number}</div>
            <div className="howto__step-visual">
              <step.Illustration />
            </div>
            <div className="howto__step-content">
              <h2 className="howto__step-title">{step.title}</h2>
              <p className="howto__step-desc">{step.description}</p>
              {step.tip && (
                <div className="howto__tip">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                  {step.tip}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
