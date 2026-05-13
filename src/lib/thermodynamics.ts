export const GAMMA = 1.4;
export const R_COMP = 9;
export const V1 = 1.0;
export const V2 = V1 / R_COMP;
export const P1 = 1.0;
export const P2 = P1 * Math.pow(R_COMP, GAMMA);
export const QIN_RATIO = 2.5;
export const P3 = P2 * QIN_RATIO;
export const P4 = P3 * Math.pow(V2 / V1, GAMMA);
export const T1 = 300;
export const T2 = T1 * Math.pow(R_COMP, GAMMA - 1);
export const T3 = T2 * QIN_RATIO;
export const T4 = T3 * Math.pow(V2 / V1, GAMMA - 1);

export const POINTS_PER_STROKE = 200;

export type Phase = 'intake' | 'compression' | 'power' | 'exhaust';

export interface CycleState {
  V: number;
  P: number;
  T: number;
  phase: Phase;
  phaseProgress: number;
}

export interface PathArrays {
  intake: CycleState[];
  compression: CycleState[];
  power: CycleState[];
  exhaust: CycleState[];
}

export const PHASE_COLORS = {
  intake: '#3b82f6',
  compression: '#f59e0b',
  power: '#ef4444',
  exhaust: '#8b5cf6',
} as const;

export const PHASE_LABELS: Record<Phase, string> = {
  intake: 'Aspirazione',
  compression: 'Compressione',
  power: 'Scoppio',
  exhaust: 'Scarico',
};

export const PHASE_DESCRIPTIONS: Record<Phase, string> = {
  intake:
    "La valvola di aspirazione si apre e il pistone scende dal PMS al PMI, creando una depressione che aspira la miscela aria-combustibile nel cilindro. Il processo avviene a pressione pressoché costante (isobara).",
  compression:
    "Entrambe le valvole sono chiuse. Il pistone risale dal PMI al PMS comprimendo adiabaticamente la miscela (senza scambio di calore con l'esterno). La temperatura e la pressione aumentano notevolmente.",
  power:
    "La candela scocca la scintilla al PMS: la combustione isocora (a volume costante) porta pressione e temperatura al massimo. Segue l'espansione adiabatica che spinge il pistone verso il PMI — è l'unica fase che produce lavoro utile.",
  exhaust:
    "La valvola di scarico si apre: la pressione cala rapidamente (trasformazione isocora). Il pistone risale espellendo i gas combusti a pressione circa costante, cedendo calore all'ambiente esterno.",
};

function buildIntakePath(): CycleState[] {
  const pts: CycleState[] = [];
  for (let i = 0; i < POINTS_PER_STROKE; i++) {
    const s = i / (POINTS_PER_STROKE - 1);
    const V = V2 + (V1 - V2) * s;
    pts.push({ V, P: P1, T: T1, phase: 'intake', phaseProgress: s });
  }
  return pts;
}

function buildCompressionPath(): CycleState[] {
  const pts: CycleState[] = [];
  for (let i = 0; i < POINTS_PER_STROKE; i++) {
    const s = i / (POINTS_PER_STROKE - 1);
    const V = V1 - (V1 - V2) * s;
    const P = P1 * Math.pow(V1 / V, GAMMA);
    const T = T1 * Math.pow(V1 / V, GAMMA - 1);
    pts.push({ V, P, T, phase: 'compression', phaseProgress: s });
  }
  return pts;
}

function buildPowerPath(): CycleState[] {
  const pts: CycleState[] = [];
  const combustionFraction = 0.05;
  const combustionPts = Math.max(2, Math.floor(POINTS_PER_STROKE * combustionFraction));
  const expansionPts = POINTS_PER_STROKE - combustionPts;

  for (let i = 0; i < combustionPts; i++) {
    const s = i / (combustionPts - 1);
    const P = P2 + (P3 - P2) * s;
    const T = T2 + (T3 - T2) * s;
    pts.push({ V: V2, P, T, phase: 'power', phaseProgress: (i / (POINTS_PER_STROKE - 1)) });
  }

  for (let i = 0; i < expansionPts; i++) {
    const s = i / (expansionPts - 1);
    const V = V2 + (V1 - V2) * s;
    const P = P3 * Math.pow(V2 / V, GAMMA);
    const T = T3 * Math.pow(V2 / V, GAMMA - 1);
    const progress = (combustionPts + i) / (POINTS_PER_STROKE - 1);
    pts.push({ V, P, T, phase: 'power', phaseProgress: progress });
  }
  return pts;
}

function buildExhaustPath(): CycleState[] {
  const pts: CycleState[] = [];
  const blowdownFraction = 0.05;
  const blowdownPts = Math.max(2, Math.floor(POINTS_PER_STROKE * blowdownFraction));
  const sweepPts = POINTS_PER_STROKE - blowdownPts;

  for (let i = 0; i < blowdownPts; i++) {
    const s = i / (blowdownPts - 1);
    const P = P4 + (P1 - P4) * s;
    const T = T4 + (T1 - T4) * s;
    pts.push({ V: V1, P, T, phase: 'exhaust', phaseProgress: (i / (POINTS_PER_STROKE - 1)) });
  }

  for (let i = 0; i < sweepPts; i++) {
    const s = i / (sweepPts - 1);
    const V = V1 - (V1 - V2) * s;
    pts.push({ V, P: P1, T: T1, phase: 'exhaust', phaseProgress: (blowdownPts + i) / (POINTS_PER_STROKE - 1) });
  }
  return pts;
}

export function buildPathArrays(): PathArrays {
  return {
    intake: buildIntakePath(),
    compression: buildCompressionPath(),
    power: buildPowerPath(),
    exhaust: buildExhaustPath(),
  };
}

const PHASES: Phase[] = ['intake', 'compression', 'power', 'exhaust'];

export function cyclePoint(t: number, paths: PathArrays): CycleState {
  const tc = ((t % 1) + 1) % 1;
  const phaseIndex = Math.min(3, Math.floor(tc * 4));
  const phase = PHASES[phaseIndex];
  const phaseT = (tc * 4) - phaseIndex;
  const arr = paths[phase];
  const idx = Math.min(arr.length - 1, Math.floor(phaseT * (arr.length - 1)));
  const frac = phaseT * (arr.length - 1) - idx;

  if (idx >= arr.length - 1) return { ...arr[arr.length - 1] };

  const a = arr[idx];
  const b = arr[idx + 1];
  return {
    V: a.V + (b.V - a.V) * frac,
    P: a.P + (b.P - a.P) * frac,
    T: a.T + (b.T - a.T) * frac,
    phase,
    phaseProgress: phaseT,
  };
}

export function pistonPosition(t: number): number {
  const tc = ((t % 1) + 1) % 1;
  const phaseIndex = Math.min(3, Math.floor(tc * 4));
  const phaseT = (tc * 4) - phaseIndex;
  switch (phaseIndex) {
    case 0: return phaseT;
    case 1: return 1 - phaseT;
    case 2: return phaseT;
    case 3: return 1 - phaseT;
    default: return 0;
  }
}

export function workExchangeLabel(phase: Phase): string {
  switch (phase) {
    case 'intake': return 'W < 0 (aspirazione)';
    case 'compression': return 'W > 0 sul gas';
    case 'power': return 'W > 0 utile (espansione)';
    case 'exhaust': return 'W > 0 (espulsione)';
  }
}
