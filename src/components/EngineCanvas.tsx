import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { CycleState, Phase } from '../lib/thermodynamics';
import { PHASE_COLORS } from '../lib/thermodynamics';

export interface EngineCanvasHandle {
  update: (state: CycleState, t: number) => void;
}

const EngineCanvas = forwardRef<EngineCanvasHandle>(function EngineCanvas(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{ state: CycleState; t: number }>({
    state: { V: 1, P: 1, T: 300, phase: 'intake', phaseProgress: 0 },
    t: 0,
  });

  useImperativeHandle(ref, () => ({
    update(state: CycleState, t: number) {
      stateRef.current = { state, t };
      draw();
    },
  }));

  useEffect(() => {
    draw();
  }, []);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { state, t } = stateRef.current;
    const { phase, phaseProgress } = state;

    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    ctx.clearRect(0, 0, W, H);

    const CX = W / 2;
    const cylinderW = W * 0.32;
    const cylinderTop = H * 0.08;
    const cylinderBottom = H * 0.58;
    const cylinderH = cylinderBottom - cylinderTop;
    const crankCenterY = H * 0.73;
    const crankRadius = cylinderH * 0.18;
    const conrodLen = cylinderH * 0.38;
    const wallThick = 4;

    const pistonFrac = pistonPosition(t);
    const pistonTravel = cylinderH * 0.55;
    const pistonTop = cylinderTop + cylinderH * 0.12 + pistonFrac * pistonTravel;
    const pistonH = 24;
    const pistonBottom = pistonTop + pistonH;

    const crankAngle = t * 4 * Math.PI;
    const crankPinX = CX + Math.sin(crankAngle) * crankRadius;
    const crankPinY = crankCenterY - Math.cos(crankAngle) * crankRadius;
    const wristPinY = pistonBottom - 4;
    const wristPinX = CX;

    // Chamber fill
    const chamberLeft = CX - cylinderW / 2 + wallThick;
    const chamberRight = CX + cylinderW / 2 - wallThick;
    const chamberW = chamberRight - chamberLeft;
    const chamberTop = cylinderTop + 18;

    drawChamberFill(ctx, chamberLeft, chamberTop, chamberW, pistonTop - chamberTop, phase, phaseProgress, isDark);

    // Cylinder walls
    ctx.strokeStyle = isDark ? '#9ca3af' : '#374151';
    ctx.lineWidth = wallThick;
    ctx.beginPath();
    ctx.moveTo(CX - cylinderW / 2, cylinderTop);
    ctx.lineTo(CX - cylinderW / 2, cylinderBottom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(CX + cylinderW / 2, cylinderTop);
    ctx.lineTo(CX + cylinderW / 2, cylinderBottom);
    ctx.stroke();

    // Cylinder head
    ctx.fillStyle = isDark ? '#4b5563' : '#9ca3af';
    ctx.fillRect(CX - cylinderW / 2 - 8, cylinderTop - 8, cylinderW + 16, 18);
    ctx.strokeStyle = isDark ? '#6b7280' : '#6b7280';
    ctx.lineWidth = 2;
    ctx.strokeRect(CX - cylinderW / 2 - 8, cylinderTop - 8, cylinderW + 16, 18);

    // Crankcase outline
    ctx.fillStyle = isDark ? '#374151' : '#d1d5db';
    ctx.beginPath();
    ctx.moveTo(CX - cylinderW / 2 - 12, cylinderBottom);
    ctx.lineTo(CX + cylinderW / 2 + 12, cylinderBottom);
    ctx.lineTo(CX + cylinderW / 2 + 30, crankCenterY + crankRadius + 30);
    ctx.lineTo(CX - cylinderW / 2 - 30, crankCenterY + crankRadius + 30);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = isDark ? '#6b7280' : '#9ca3af';
    ctx.lineWidth = 2;
    ctx.stroke();

    // TDC / PMI reference lines
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = isDark ? '#6b7280' : '#9ca3af';
    ctx.lineWidth = 1;
    const tdcY = cylinderTop + cylinderH * 0.12;
    const bmiY = tdcY + pistonTravel;
    ctx.beginPath();
    ctx.moveTo(CX - cylinderW / 2 - 20, tdcY);
    ctx.lineTo(CX + cylinderW / 2 + 20, tdcY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(CX - cylinderW / 2 - 20, bmiY);
    ctx.lineTo(CX + cylinderW / 2 + 20, bmiY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '10px sans-serif';
    ctx.fillStyle = isDark ? '#9ca3af' : '#6b7280';
    ctx.textAlign = 'right';
    ctx.fillText('PMS', CX - cylinderW / 2 - 24, tdcY + 4);
    ctx.fillText('PMI', CX - cylinderW / 2 - 24, bmiY + 4);

    // Valves
    drawValve(ctx, CX - cylinderW * 0.25, cylinderTop, phase === 'intake', 'intake', isDark);
    drawValve(ctx, CX + cylinderW * 0.25, cylinderTop, phase === 'exhaust', 'exhaust', isDark);

    // Spark plug
    drawSparkPlug(ctx, CX, cylinderTop, phase === 'power' && phaseProgress < 0.08, isDark);

    // Piston
    ctx.fillStyle = isDark ? '#6b7280' : '#71717a';
    const pistonLeft = CX - cylinderW / 2 + wallThick + 3;
    const pistonW = cylinderW - wallThick * 2 - 6;
    ctx.fillRect(pistonLeft, pistonTop, pistonW, pistonH);
    ctx.strokeStyle = isDark ? '#9ca3af' : '#52525b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pistonLeft, pistonTop, pistonW, pistonH);

    // Piston rings
    ctx.strokeStyle = isDark ? '#d1d5db' : '#3f3f46';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const ry = pistonTop + 4 + i * 6;
      ctx.beginPath();
      ctx.moveTo(pistonLeft + 2, ry);
      ctx.lineTo(pistonLeft + pistonW - 2, ry);
      ctx.stroke();
    }

    // Wrist pin
    ctx.fillStyle = isDark ? '#d1d5db' : '#52525b';
    ctx.beginPath();
    ctx.arc(wristPinX, wristPinY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Connecting rod
    ctx.strokeStyle = isDark ? '#9ca3af' : '#52525b';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(wristPinX, wristPinY);
    ctx.lineTo(crankPinX, crankPinY);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Crankshaft circle
    ctx.strokeStyle = isDark ? '#6b7280' : '#a1a1aa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CX, crankCenterY, crankRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Crankpin
    ctx.fillStyle = isDark ? '#f59e0b' : '#d97706';
    ctx.beginPath();
    ctx.arc(crankPinX, crankPinY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Crank center
    ctx.fillStyle = isDark ? '#9ca3af' : '#71717a';
    ctx.beginPath();
    ctx.arc(CX, crankCenterY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Gas animations
    drawGasAnimations(ctx, CX, cylinderW, chamberTop, pistonTop, phase, phaseProgress, isDark, t);

    // Progress bar
    drawProgressBar(ctx, W, H, t);
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  );
});

function pistonPosition(t: number): number {
  const tc = ((t % 1) + 1) % 1;
  const pi = Math.min(3, Math.floor(tc * 4));
  const pt = (tc * 4) - pi;
  switch (pi) {
    case 0: return pt;
    case 1: return 1 - pt;
    case 2: return pt;
    case 3: return 1 - pt;
    default: return 0;
  }
}

function drawChamberFill(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  phase: Phase, progress: number, isDark: boolean,
) {
  if (h <= 0) return;
  let color: string;
  switch (phase) {
    case 'intake':
      color = isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.15)';
      break;
    case 'compression': {
      const orange = Math.floor(progress * 180);
      color = `rgba(${200 + Math.floor(progress * 55)},${130 - orange * 0.5},0,${0.15 + progress * 0.2})`;
      break;
    }
    case 'power':
      if (progress < 0.1) {
        color = isDark ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.4)';
      } else {
        const fade = Math.max(0, 1 - (progress - 0.1) / 0.9);
        color = `rgba(239,${Math.floor(68 + (1 - fade) * 100)},${Math.floor(68 + (1 - fade) * 50)},${0.15 + fade * 0.25})`;
      }
      break;
    case 'exhaust':
      color = isDark ? 'rgba(120,90,60,0.2)' : 'rgba(120,90,60,0.12)';
      break;
  }
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawValve(
  ctx: CanvasRenderingContext2D,
  cx: number, headY: number,
  isOpen: boolean, side: 'intake' | 'exhaust',
  isDark: boolean,
) {
  const stemLen = 20;
  const discW = 18;
  const discH = 4;
  const openOffset = isOpen ? 12 : 0;
  const stemTop = headY - 8 - stemLen;
  const stemBottom = headY - 8 + openOffset;

  ctx.strokeStyle = isDark ? '#d1d5db' : '#52525b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, stemTop);
  ctx.lineTo(cx, stemBottom);
  ctx.stroke();

  ctx.fillStyle = side === 'intake'
    ? (isDark ? '#3b82f6' : '#2563eb')
    : (isDark ? '#ef4444' : '#dc2626');
  ctx.beginPath();
  ctx.ellipse(cx, stemBottom + discH / 2, discW / 2, discH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isDark ? '#9ca3af' : '#374151';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawSparkPlug(
  ctx: CanvasRenderingContext2D,
  cx: number, headY: number,
  firing: boolean, isDark: boolean,
) {
  const top = headY - 28;
  ctx.fillStyle = isDark ? '#fbbf24' : '#d97706';
  ctx.fillRect(cx - 4, top, 8, 12);
  ctx.strokeStyle = isDark ? '#9ca3af' : '#6b7280';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, top + 12);
  ctx.lineTo(cx, headY - 2);
  ctx.stroke();

  if (firing) {
    const grad = ctx.createRadialGradient(cx, headY + 8, 0, cx, headY + 8, 30);
    grad.addColorStop(0, 'rgba(255,255,100,0.9)');
    grad.addColorStop(0.4, 'rgba(255,160,0,0.5)');
    grad.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, headY + 8, 30, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGasAnimations(
  ctx: CanvasRenderingContext2D,
  CX: number, cylinderW: number,
  chamberTop: number, pistonTop: number,
  phase: Phase, progress: number,
  isDark: boolean, t: number,
) {
  const leftX = CX - cylinderW * 0.25;
  const rightX = CX + cylinderW * 0.25;
  const chamberH = pistonTop - chamberTop;

  if (phase === 'intake') {
    ctx.strokeStyle = isDark ? '#60a5fa' : '#3b82f6';
    ctx.lineWidth = 2;
    const arrowCount = 5;
    for (let i = 0; i < arrowCount; i++) {
      const offset = ((progress * 3 + i / arrowCount) % 1);
      const ay = chamberTop - 30 + offset * (chamberH + 20);
      if (ay > chamberTop && ay < pistonTop - 5) {
        drawArrow(ctx, leftX, ay, 0, 8);
      }
    }
    // particles
    ctx.fillStyle = isDark ? 'rgba(96,165,250,0.6)' : 'rgba(59,130,246,0.5)';
    for (let i = 0; i < 12; i++) {
      const seed = i * 137.5 + t * 800;
      const px = CX + Math.sin(seed) * (cylinderW * 0.3) * progress;
      const py = chamberTop + ((seed * 0.1) % 1) * chamberH * progress;
      if (py < pistonTop - 3) {
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (phase === 'compression') {
    ctx.fillStyle = isDark ? 'rgba(251,191,36,0.5)' : 'rgba(245,158,11,0.4)';
    const density = 8 + Math.floor(progress * 20);
    for (let i = 0; i < density; i++) {
      const seed = i * 97.3;
      const px = CX + (Math.sin(seed) * cylinderW * 0.35);
      const py = chamberTop + ((Math.cos(seed * 0.7) * 0.5 + 0.5)) * chamberH;
      if (py < pistonTop - 3 && py > chamberTop) {
        ctx.beginPath();
        ctx.arc(px, py, 1.5 + progress, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (phase === 'power' && progress < 0.15) {
    const flash = 1 - progress / 0.15;
    const grad = ctx.createRadialGradient(CX, chamberTop + 10, 0, CX, chamberTop + 10, 40 + progress * 100);
    grad.addColorStop(0, `rgba(255,255,100,${flash * 0.8})`);
    grad.addColorStop(0.5, `rgba(255,100,0,${flash * 0.4})`);
    grad.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(CX, chamberTop + 10, 40 + progress * 100, 0, Math.PI * 2);
    ctx.fill();
  }

  if (phase === 'exhaust') {
    ctx.strokeStyle = isDark ? 'rgba(168,162,158,0.6)' : 'rgba(120,113,108,0.5)';
    ctx.lineWidth = 2;
    const arrowCount = 5;
    for (let i = 0; i < arrowCount; i++) {
      const offset = ((progress * 3 + i / arrowCount) % 1);
      const ay = pistonTop - 10 - offset * (chamberH + 20);
      if (ay > chamberTop && ay < pistonTop - 5) {
        drawArrow(ctx, rightX, ay, Math.PI, 8);
      }
    }
  }
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(0, size);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-4, size - 5);
  ctx.lineTo(0, size);
  ctx.lineTo(4, size - 5);
  ctx.stroke();
  ctx.restore();
}

function drawProgressBar(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  const barY = H - 20;
  const barH = 10;
  const barW = W - 40;
  const barX = 20;

  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(barX, barY, barW, barH);

  const phases: Phase[] = ['intake', 'compression', 'power', 'exhaust'];
  for (let i = 0; i < 4; i++) {
    const segStart = i / 4;
    const segEnd = (i + 1) / 4;
    const fillEnd = Math.min(segEnd, t);
    if (fillEnd > segStart) {
      ctx.fillStyle = PHASE_COLORS[phases[i]];
      ctx.fillRect(
        barX + segStart * barW,
        barY,
        (fillEnd - segStart) * barW,
        barH,
      );
    }
  }

  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  for (let i = 1; i < 4; i++) {
    const dx = barX + (i / 4) * barW;
    ctx.beginPath();
    ctx.moveTo(dx, barY);
    ctx.lineTo(dx, barY + barH);
    ctx.stroke();
  }
}

export default EngineCanvas;
