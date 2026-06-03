// Shapes returned by GET /api/wrapped and GET /api/wrapped/person/:id

export type AwardWinner = {
  participantId: string;
  name: string;
  imageUrl: string | null;
  value: string;
  detail: string;
  coIds?: string[];
  winners?: { participantId: string; name: string; imageUrl: string | null }[];
} | null;

export type PodiumEntry = {
  participantId: string;
  name: string;
  imageUrl: string | null;
  seconds: number;
  dateISO: string | null;
};

export type RecordEntry = {
  participantId: string;
  name: string;
  imageUrl: string | null;
  seconds: number;
  dateISO: string;
};

export type TimeSeriesPoint = {
  sessionId: string;
  dateISO: string;
  avg: number;
  bestClean: number | null;
  attempts: number;
  wetRate: number;
};

export type CrossBreakdownEntry = { code: string; label: string; count: number };

export type MonthlyEntry = {
  key: string;
  label: string;
  chugs: number;
  avg: number;
  bestClean: number | null;
};

export type WrappedParticipant = {
  id: string;
  name: string;
  isRegular: boolean;
  imageUrl: string | null;
  n: number;
  bestClean: number | null;
  avg: number;
  improvement: number;
  crossesTotal: number;
  titleLabel: string | null;
  titleEmoji: string | null;
};

export type Rivalry = {
  a: { participantId: string; name: string; imageUrl: string | null; wins: number };
  b: { participantId: string; name: string; imageUrl: string | null; wins: number };
  shared: number;
} | null;

export type GroupWrapped = {
  semester: string;
  semesterLabel: string;
  meta: {
    generatedAt: string;
    rangeFromISO: string | null;
    rangeToISO: string | null;
    rangeLabel: string;
  };
  totals: {
    sessions: number;
    chugs: number;
    participants: number;
    regulars: number;
    guests: number;
    totalSeconds: number;
    totalMinutes: number;
    totalBeers: number;
    totalLitres: number;
    litresPerChug: number;
    avg: number | null;
    cleanRate: number;
    wetRate: number;
    totalCrosses: number;
    fastestClean: RecordEntry | null;
    slowest: RecordEntry | null;
  };
  podium: PodiumEntry[];
  awards: Record<string, AwardWinner>;
  roasts: Record<string, AwardWinner>;
  charts: { timeSeries: TimeSeriesPoint[]; crossBreakdown: CrossBreakdownEntry[] };
  monthly: MonthlyEntry[];
  rivalry: Rivalry;
  participants: WrappedParticipant[];
};

export type WrappedTitle = { key: string; label: string; emoji: string; blurb: string };

export type WrappedRival = {
  participantId: string;
  name: string;
  imageUrl: string | null;
  meetings: number;
  youWon: number;
  theyWon: number;
} | null;

export type PersonWrapped = {
  participant: { id: string; name: string; isRegular: boolean; imageUrl: string | null };
  semester: string;
  semesterLabel: string;
  title: WrappedTitle;
  aura: { word: string; hint: string };
  classification: { label: string; lines: string[] };
  rival: WrappedRival;
  stats: {
    chugs: number;
    totalBeers: number;
    totalLitres: number;
    totalSeconds: number;
    totalMinutes: number;
    avg: number;
    best: number | null;
    bestClean: number | null;
    bestCleanDateISO: string | null;
    stddev: number;
    improvement: number;
    improvementPct: number;
    firstSeconds: number | null;
    attendance: number;
    totalSessions: number;
    wetCount: number;
    wetRate: number;
    crossesTotal: number;
    violationCount: number;
    sessionWins: number;
    sessionLosses: number;
  };
  rankings: {
    bestCleanRank: number | null;
    bestCleanRankAll: number | null;
    bestCleanRankRegular: number | null;
    totalRanked: number;
    totalRankedAll: number;
    totalRankedRegular: number;
    percentile: number | null;
    crossRank: number | null;
  };
  comparison: { groupAvg: number | null; avgDelta: number | null; groupWetRate: number };
  fastestDay: { dateISO: string; seconds: number; codes: string[] } | null;
  slowestDay: { dateISO: string; seconds: number; codes: string[] } | null;
  crossBreakdown: CrossBreakdownEntry[];
  perSemester: Record<string, { n: number; bestClean: number | null; avg: number | null }>;
  awardsWon: { key: string; label: string; emoji: string; kind: "award" | "roast" }[];
  timeSeries: { dateISO: string; seconds: number; clean: boolean; wet: boolean }[];
  monthly: MonthlyEntry[];
};

/** Badge shape from GET /api/person/:id (the real profile badges). */
export type ProfileBadge = {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  earned: boolean;
};

// ---- shared formatting helpers ----

export function fmtSeconds(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "–";
  return `${value.toFixed(2)}s`;
}

const NB_MONTHS = [
  "jan", "feb", "mar", "apr", "mai", "jun",
  "jul", "aug", "sep", "okt", "nov", "des",
];

export function fmtShortDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(iso);
  return `${d.getDate()}. ${NB_MONTHS[d.getMonth()]}`;
}
