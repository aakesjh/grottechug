/**
 * SVG medal badge — trapezoid ribbon (vertical stripes) + metallic disc.
 * All badge-specific colors and content are defined here; CSS only handles
 * sizing, drop-shadow, and glow animations.
 */

/* ── Ribbon themes per category ────────────────────────────────────────── */
const RIBBON: Record<string, { base: string; dark: string; stripe: string; edge: string }> = {
  milestone: { base: '#1e40af', dark: '#152e7a', stripe: '#fbbf24',  edge: 'rgba(96,165,250,0.25)' },
  speed:     { base: '#b91c1c', dark: '#7f1d1d', stripe: '#fecdd3',  edge: 'rgba(248,113,113,0.25)' },
  special:   { base: '#7c3aed', dark: '#4c1d95', stripe: '#c4b5fd',  edge: 'rgba(167,139,250,0.25)' },
  negative:  { base: '#374151', dark: '#1f2937', stripe: '#f87171',  edge: 'rgba(107,114,128,0.25)' },
};

/* ── Disc gradient stops (highlight, mid, dark) ────────────────────────── */
const DISC: Record<string, [string, string, string]> = {
  'first-chug':       ['#d4956a', '#8b5e3c', '#5a3620'],
  'session-loser':    ['#e06070', '#a03040', '#601820'],
  'puker':            ['#a8d850', '#6a9a28', '#3a6010'],
  'spiller':          ['#9080e0', '#6050b0', '#3a2880'],
  'sinner':           ['#f04050', '#b02030', '#700818'],
  'five-chugs':       ['#eab080', '#a06830', '#7a4c18'],
  'ten-chugs':        ['#e2e5ea', '#9ca3af', '#6b7280'],
  'fifteen-chugs':    ['#f3f4f8', '#b8c0cc', '#8892a0'],
  'twenty-chugs':     ['#ffe680', '#d4a020', '#a07c10'],
  'twentyfive-chugs': ['#fff8cc', '#ffd700', '#b8860b'],
  'sub-20':           ['#b4eff4', '#5ec4cc', '#3a9da6'],
  'sub-15':           ['#7ce6f6', '#22b8d6', '#0e7e96'],
  'sub-10':           ['#50d6ee', '#0891b2', '#065a73'],
  'sub-5':            ['#6cd4f8', '#0284c7', '#0369a1'],
  'sub-3':            ['#c0f4ff', '#2bd2ff', '#0284c7'],
  'clean-streak':     ['#ddd6fe', '#a78bfa', '#6d28d9'],
  'improver':         ['#a7f3d0', '#34d399', '#059669'],
  'consistent':       ['#fce7f3', '#f472b6', '#be185d'],
  'session-winner':   ['#fef3c7', '#fbbf24', '#d97706'],
  'ironman':          ['#d1d5db', '#6b7280', '#374151'],
};

/* ── Disc border colors ────────────────────────────────────────────────── */
const DISC_BORDER: Record<string, string> = {
  'first-chug':       'rgba(160,112,74,0.5)',
  'session-loser':    'rgba(200,50,70,0.5)',
  'puker':            'rgba(106,154,40,0.5)',
  'spiller':          'rgba(100,80,180,0.5)',
  'sinner':           'rgba(220,40,60,0.55)',
  'five-chugs':       'rgba(184,120,64,0.55)',
  'ten-chugs':        'rgba(180,185,195,0.55)',
  'fifteen-chugs':    'rgba(210,215,225,0.6)',
  'twenty-chugs':     'rgba(212,160,32,0.55)',
  'twentyfive-chugs': 'rgba(255,215,0,0.7)',
  'sub-20':           'rgba(94,196,204,0.45)',
  'sub-15':           'rgba(34,184,214,0.5)',
  'sub-10':           'rgba(8,145,178,0.55)',
  'sub-5':            'rgba(14,165,233,0.6)',
  'sub-3':            'rgba(43,210,255,0.75)',
  'clean-streak':     'rgba(167,139,250,0.5)',
  'improver':         'rgba(52,211,153,0.5)',
  'consistent':       'rgba(244,114,182,0.5)',
  'session-winner':   'rgba(251,191,36,0.6)',
  'ironman':          'rgba(107,114,128,0.55)',
};

/* ── Text-label overrides (numbered / labeled badges) ──────────────────── */
const LABEL: Record<string, { text: string; color: string; size: number }> = {
  'five-chugs':    { text: '5',   color: '#2e1405', size: 15 },
  'ten-chugs':     { text: '10',  color: '#1f2937', size: 12 },
  'fifteen-chugs': { text: '15',  color: '#1a1f2e', size: 12 },
  'twenty-chugs':  { text: '20',  color: '#3d2800', size: 12 },
  'sub-20':        { text: '<20', color: '#0a2e33', size: 10 },
  'sub-15':        { text: '<15', color: '#062830', size: 10 },
  'sub-10':        { text: '<10', color: '#e0fbff', size: 10 },
  'sub-5':         { text: '<5',  color: '#e0f2fe', size: 11 },
};

/* ── Ribbon SVG path — short trapezoid, wider at top, V-notch at bottom ─ */
const RIBBON_PATH = 'M 10,0 L 50,0 L 42,22 L 30,16 L 18,22 Z';

type Props = {
  badgeId: string;
  category: string;
  icon: string;
};

export function BadgeMedal({ badgeId, category, icon }: Props) {
  const r  = RIBBON[category] ?? RIBBON.special;
  const d  = DISC[badgeId]    ?? ['#ccc', '#999', '#666'];
  const db = DISC_BORDER[badgeId] ?? 'rgba(150,150,150,0.5)';
  const label = LABEL[badgeId];

  // IDs are unique per badge (only one instance of each badgeId on page)
  const pid = `rbn-${badgeId}`;
  const gid = `dsc-${badgeId}`;
  const oid = `ovl-${badgeId}`;

  return (
    <svg
      viewBox="0 0 60 62"
      className={`person__badge-medal person__badge-icon--${badgeId}`}
      aria-hidden="true"
    >
      <defs>
        {/* Vertical stripe pattern */}
        <pattern id={pid} width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill={r.base} />
          <rect width="1.5" height="5" fill={r.stripe} opacity="0.45" />
          <rect x="3.5" width="1.5" height="5" fill={r.dark} opacity="0.35" />
        </pattern>

        {/* Horizontal light-to-dark overlay for ribbon depth */}
        <linearGradient id={oid} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%"   stopColor="#000" stopOpacity="0.22" />
          <stop offset="50%"  stopColor="#fff" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>

        {/* Metallic disc radial gradient */}
        <radialGradient id={gid} cx="38%" cy="36%">
          <stop offset="0%"   stopColor={d[0]} />
          <stop offset="55%"  stopColor={d[1]} />
          <stop offset="100%" stopColor={d[2]} />
        </radialGradient>
      </defs>

      {/* ── Ribbon ────────────────────────────── */}
      <path d={RIBBON_PATH} fill={`url(#${pid})`} />
      <path d={RIBBON_PATH} fill={`url(#${oid})`} />
      <path d={RIBBON_PATH} fill="none" stroke={r.edge} strokeWidth="0.8" />

      {/* ── Medal disc ────────────────────────── */}
      <circle cx="30" cy="40" r="20" fill={`url(#${gid})`}
        stroke={db} strokeWidth="2.2" />

      {/* Inner highlight ring */}
      <circle cx="30" cy="40" r="16.5" fill="none"
        stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />

      {/* Bottom shadow arc for depth */}
      <path d="M 13,46 A 20,20 0 0,0 47,46" fill="none"
        stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />

      {/* Top shine highlight */}
      <ellipse cx="24" cy="33" rx="7" ry="4" fill="rgba(255,255,255,0.08)"
        transform="rotate(-15 24 33)" />

      {/* ── Content ───────────────────────────── */}
      {label ? (
        <text
          x="30" y="41"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={label.size}
          fontWeight="900"
          fill={label.color}
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          {label.text}
        </text>
      ) : (
        <foreignObject x="10" y="20" width="40" height="40">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              fontSize: '17px',
              lineHeight: 1,
            }}
          >
            {icon}
          </div>
        </foreignObject>
      )}
    </svg>
  );
}
