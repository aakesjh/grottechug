import "../styles/pages/howto.css";

function CupPourSVG() {
  return (
    <svg className="howto__illustration" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Beer can — tilted */}
      <g transform="rotate(-40 60 50)">
        <rect x="38" y="20" width="44" height="64" rx="6" fill="color-mix(in srgb, var(--accent3) 18%, transparent)" stroke="var(--accent3)" strokeWidth="2" />
        {/* Can top rim */}
        <ellipse cx="60" cy="22" rx="22" ry="5" fill="color-mix(in srgb, var(--accent3) 12%, transparent)" stroke="var(--accent3)" strokeWidth="1.5" />
        {/* Can bottom rim */}
        <ellipse cx="60" cy="82" rx="22" ry="5" fill="color-mix(in srgb, var(--accent3) 8%, transparent)" stroke="var(--accent3)" strokeWidth="1" />
        {/* Can tab */}
        <ellipse cx="60" cy="18" rx="6" ry="2.5" fill="color-mix(in srgb, var(--accent3) 30%, transparent)" stroke="var(--accent3)" strokeWidth="1" />
        {/* Can label stripe */}
        <rect x="38" y="40" width="44" height="14" fill="color-mix(in srgb, var(--accent3) 10%, transparent)" />
      </g>
      {/* Pour stream */}
      <path d="M78 54 Q88 80 100 96" stroke="var(--accent3)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 4" opacity="0.7" />
      <path d="M80 58 Q90 82 103 94" stroke="var(--accent3)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 5" opacity="0.5" />
      {/* Foam / splash */}
      <circle cx="96" cy="88" r="2.5" fill="color-mix(in srgb, var(--accent3) 40%, transparent)" />
      <circle cx="103" cy="84" r="1.8" fill="color-mix(in srgb, var(--accent3) 30%, transparent)" />
      <circle cx="100" cy="92" r="2" fill="color-mix(in srgb, var(--accent3) 35%, transparent)" />
      {/* Cup */}
      <path d="M85 100 L89 160 L131 160 L135 100 Z" fill="color-mix(in srgb, var(--accent) 12%, transparent)" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      {/* Liquid in cup */}
      <path d="M89 122 L91 158 L129 158 L131 122 Z" fill="color-mix(in srgb, var(--accent3) 25%, transparent)" />
      {/* 0.5L label */}
      <text x="110" y="146" textAnchor="middle" fill="var(--muted)" fontSize="11" fontWeight="600">0.5L</text>
      {/* Carbonation fizz */}
      <path d="M100 118 L100 111" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M110 120 L110 112" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M120 117 L120 110" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function KneelSVG() {
  return (
    <svg className="howto__illustration" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Counter / table */}
      <rect x="10" y="70" width="180" height="8" rx="3" fill="rgba(255,255,255,0.1)" stroke="var(--border)" strokeWidth="1" />
      <rect x="20" y="78" width="6" height="60" rx="2" fill="rgba(255,255,255,0.06)" />
      <rect x="174" y="78" width="6" height="60" rx="2" fill="rgba(255,255,255,0.06)" />
      {/* Cup on counter */}
      <path d="M120 48 L122 70 L148 70 L150 48 Z" fill="color-mix(in srgb, var(--accent) 12%, transparent)" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M122 55 L123 69 L147 69 L148 55 Z" fill="color-mix(in srgb, var(--accent3) 20%, transparent)" />
      {/* Person — sideways, one knee down */}
      {/* Head */}
      <circle cx="85" cy="98" r="11" fill="color-mix(in srgb, var(--accent2) 15%, transparent)" stroke="var(--accent2)" strokeWidth="2" />
      {/* Body — angled slightly forward */}
      <line x1="85" y1="109" x2="90" y2="140" stroke="var(--accent2)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Front arm reaching to counter */}
      <line x1="87" y1="118" x2="120" y2="72" stroke="var(--accent2)" strokeWidth="2" strokeLinecap="round" />
      {/* Back arm resting */}
      <line x1="87" y1="118" x2="75" y2="130" stroke="var(--accent2)" strokeWidth="2" strokeLinecap="round" />
      {/* Front leg — knee on ground */}
      <line x1="90" y1="140" x2="75" y2="160" stroke="var(--accent2)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Front shin flat on ground */}
      <line x1="75" y1="160" x2="60" y2="162" stroke="var(--accent2)" strokeWidth="2" strokeLinecap="round" />
      {/* Back leg — foot planted */}
      <line x1="90" y1="140" x2="110" y2="158" stroke="var(--accent2)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="110" y1="158" x2="115" y2="162" stroke="var(--accent2)" strokeWidth="2" strokeLinecap="round" />
      {/* Ground line */}
      <line x1="30" y1="164" x2="170" y2="164" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
    </svg>
  );
}

function DrinkSVG() {
  return (
    <svg className="howto__illustration" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Person head — tilted back */}
      <circle cx="110" cy="38" r="13" fill="color-mix(in srgb, var(--accent2) 15%, transparent)" stroke="var(--accent2)" strokeWidth="2" />
      {/* Mouth open */}
      <ellipse cx="116" cy="42" rx="3.5" ry="3" fill="rgba(255,255,255,0.15)" />
      {/* Cup tilted to mouth */}
      <path d="M120 20 L128 48 L146 42 L140 14 Z" fill="color-mix(in srgb, var(--accent) 15%, transparent)" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M125 28 L128 46 L143 41 L141 24 Z" fill="color-mix(in srgb, var(--accent3) 25%, transparent)" />
      {/* Pour into mouth */}
      <path d="M122 44 Q118 44 116 43" stroke="var(--accent3)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      {/* Arms holding cup */}
      <line x1="108" y1="62" x2="128" y2="36" stroke="var(--accent2)" strokeWidth="2" strokeLinecap="round" />
      <line x1="108" y1="62" x2="140" y2="40" stroke="var(--accent2)" strokeWidth="2" strokeLinecap="round" />
      {/* Body — slightly forward */}
      <line x1="110" y1="51" x2="105" y2="100" stroke="var(--accent2)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Timer icon */}
      <circle cx="38" cy="70" r="20" fill="color-mix(in srgb, var(--accent) 10%, transparent)" stroke="var(--accent)" strokeWidth="1.5" />
      <line x1="38" y1="70" x2="38" y2="58" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      <line x1="38" y1="70" x2="48" y2="70" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      <text x="38" y="100" textAnchor="middle" fill="var(--accent)" fontSize="10" fontWeight="700">START</text>
      {/* One-knee pose: front knee down */}
      <line x1="105" y1="100" x2="88" y2="128" stroke="var(--accent2)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Shin flat on ground */}
      <line x1="88" y1="128" x2="74" y2="132" stroke="var(--accent2)" strokeWidth="2" strokeLinecap="round" />
      {/* Back leg — foot planted */}
      <line x1="105" y1="100" x2="122" y2="126" stroke="var(--accent2)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="122" y1="126" x2="126" y2="132" stroke="var(--accent2)" strokeWidth="2" strokeLinecap="round" />
      {/* Ground line */}
      <line x1="40" y1="134" x2="170" y2="134" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
    </svg>
  );
}

function KeepInsideSVG() {
  return (
    <svg className="howto__illustration" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Person head (bigger to show cheeks) */}
      <circle cx="105" cy="38" r="18" fill="color-mix(in srgb, var(--accent2) 15%, transparent)" stroke="var(--accent2)" strokeWidth="2" />
      {/* Puffed cheeks */}
      <ellipse cx="90" cy="42" rx="6" ry="5" fill="color-mix(in srgb, var(--accent3) 20%, transparent)" stroke="var(--accent3)" strokeWidth="1" />
      <ellipse cx="120" cy="42" rx="6" ry="5" fill="color-mix(in srgb, var(--accent3) 20%, transparent)" stroke="var(--accent3)" strokeWidth="1" />
      {/* Eyes (determined) */}
      <circle cx="98" cy="34" r="2" fill="var(--text)" />
      <circle cx="112" cy="34" r="2" fill="var(--text)" />
      {/* Closed mouth */}
      <line x1="100" y1="46" x2="110" y2="46" stroke="var(--text)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Check mark */}
      <path d="M160 25 L168 35 L182 17" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {/* Warning X for spilling */}
      <path d="M20 25 L32 37 M32 25 L20 37" stroke="var(--danger)" strokeWidth="2.5" strokeLinecap="round" />
      <text x="26" y="52" textAnchor="middle" fill="var(--danger)" fontSize="8" fontWeight="600">Søl</text>
      {/* Body */}
      <line x1="105" y1="56" x2="100" y2="100" stroke="var(--accent2)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Cup still held */}
      <path d="M130 65 L132 88 L148 88 L150 65 Z" fill="color-mix(in srgb, var(--accent) 10%, transparent)" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
      <line x1="105" y1="70" x2="135" y2="72" stroke="var(--accent2)" strokeWidth="2" strokeLinecap="round" />
      {/* Other arm */}
      <line x1="105" y1="70" x2="85" y2="82" stroke="var(--accent2)" strokeWidth="2" strokeLinecap="round" />
      {/* One-knee pose: front knee down */}
      <line x1="100" y1="100" x2="84" y2="126" stroke="var(--accent2)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Shin flat on ground */}
      <line x1="84" y1="126" x2="68" y2="130" stroke="var(--accent2)" strokeWidth="2" strokeLinecap="round" />
      {/* Back leg — foot planted */}
      <line x1="100" y1="100" x2="118" y2="126" stroke="var(--accent2)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="118" y1="126" x2="122" y2="132" stroke="var(--accent2)" strokeWidth="2" strokeLinecap="round" />
      {/* Ground line */}
      <line x1="40" y1="134" x2="170" y2="134" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
    </svg>
  );
}

function CupDownSVG() {
  return (
    <svg className="howto__illustration" viewBox="0 0 200 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Counter */}
      <rect x="10" y="90" width="180" height="8" rx="3" fill="rgba(255,255,255,0.1)" stroke="var(--border)" strokeWidth="1" />
      {/* Cup slamming down — impact lines */}
      <line x1="95" y1="60" x2="88" y2="50" stroke="var(--accent3)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="115" y1="60" x2="122" y2="50" stroke="var(--accent3)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="105" y1="58" x2="105" y2="46" stroke="var(--accent3)" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      {/* Cup on counter */}
      <path d="M90 68 L92 90 L118 90 L120 68 Z" fill="color-mix(in srgb, var(--accent) 15%, transparent)" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      {/* Empty cup shine */}
      <line x1="97" y1="72" x2="97" y2="82" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Timer — STOP */}
      <circle cx="160" cy="130" r="20" fill="rgba(255,77,109,0.12)" stroke="var(--danger)" strokeWidth="1.5" />
      <rect x="152" y="122" width="16" height="16" rx="3" fill="var(--danger)" opacity="0.4" />
      <text x="160" y="160" textAnchor="middle" fill="var(--danger)" fontSize="10" fontWeight="700">STOPP</text>
      {/* Person celebrating */}
      <circle cx="50" cy="115" r="10" fill="color-mix(in srgb, var(--accent2) 15%, transparent)" stroke="var(--accent2)" strokeWidth="2" />
      <line x1="50" y1="125" x2="50" y2="155" stroke="var(--accent2)" strokeWidth="2.5" strokeLinecap="round" />
      {/* Arms up celebration */}
      <line x1="50" y1="132" x2="35" y2="118" stroke="var(--accent2)" strokeWidth="2" strokeLinecap="round" />
      <line x1="50" y1="132" x2="65" y2="118" stroke="var(--accent2)" strokeWidth="2" strokeLinecap="round" />
      {/* Mean time note */}
      <text x="105" y="115" textAnchor="middle" fill="var(--muted)" fontSize="9">t = (t₁ + t₂) / 2</text>
    </svg>
  );
}

const steps = [
  {
    number: 1,
    title: "Hell i koppen",
    description: "Hell drikken din i en 0.5-liters plastkopp.",
    tip: "Hell hardt og tidlig — det reduserer kullsyren og gjør chuggingen lettere.",
    Illustration: CupPourSVG,
    accent: "orange",
  },
  {
    number: 2,
    title: "Klar ved disken",
    description: "Gå ned på knærne ved disken og gjør deg klar.",
    tip: null,
    Illustration: KneelSVG,
    accent: "cyan",
  },
  {
    number: 3,
    title: "Start chuggingen",
    description: "Sett koppen til munnen og begynn å drikke. Timeren starter når første dråpe treffer leppene dine.",
    tip: null,
    Illustration: DrinkSVG,
    accent: "purple",
  },
  {
    number: 4,
    title: "Hold alt inni munnen",
    description: "Drikk til du er ferdig. Hold så mye som mulig inni munnen for å unngå anmerkninger.",
    tip: "Søl = kryss! Hold leppene tett rundt koppen.",
    Illustration: KeepInsideSVG,
    accent: "pink",
  },
  {
    number: 5,
    title: "Sett ned koppen",
    description: "Når du er ferdig, sett koppen tilbake på disken. Timeren stopper når koppen treffer disken.",
    tip: "Tiden din blir gjennomsnittet av (minst) to målte tider.",
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
  return (
    <div className="howto">
      <div className="howto__hero">
        <h1 className="howto__title">Slik chugger du</h1>
        <p className="howto__subtitle">Grottechug på 5 enkle steg</p>
      </div>

      <div className="howto__steps">
        {steps.map((step) => (
          <div
            key={step.number}
            className="howto__step"
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
