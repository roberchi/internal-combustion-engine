import { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import Box from '@mui/material/Box';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import GridOnIcon from '@mui/icons-material/GridOn';
import ThreeSixtyIcon from '@mui/icons-material/ThreeSixty';
import Typography from '@mui/material/Typography';
import type { CycleState, Phase } from '../lib/thermodynamics';
import { PHASE_COLORS } from '../lib/thermodynamics';
import { Engine3DRenderer } from './Engine3D';

export interface EngineCanvasHandle {
  update: (state: CycleState, t: number) => void;
}

type ViewMode = '2d' | '3d';

const EngineCanvas = forwardRef<EngineCanvasHandle>(function EngineCanvas(_, ref) {
  const [viewMode, setViewMode] = useState<ViewMode>('2d');

  const canvas2dRef = useRef<HTMLCanvasElement>(null);
  const container3dRef = useRef<HTMLDivElement>(null);
  const renderer3dRef = useRef<Engine3DRenderer | null>(null);

  const stateRef = useRef<{ state: CycleState; t: number }>({
    state: { V: 1, P: 1, T: 300, phase: 'intake', phaseProgress: 0 },
    t: 0,
  });

  useImperativeHandle(ref, () => ({
    update(state: CycleState, t: number) {
      stateRef.current = { state, t };
      if (viewMode === '2d') {
        draw2d();
      } else {
        renderer3dRef.current?.update(state, t);
      }
    },
  }), [viewMode]);

  // Init / destroy 3D renderer when switching
  useEffect(() => {
    if (viewMode === '3d' && container3dRef.current && !renderer3dRef.current) {
      renderer3dRef.current = new Engine3DRenderer(container3dRef.current);
      renderer3dRef.current.update(stateRef.current.state, stateRef.current.t);
    }
    return () => {
      if (viewMode !== '3d' && renderer3dRef.current) {
        renderer3dRef.current.dispose();
        renderer3dRef.current = null;
      }
    };
  }, [viewMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      renderer3dRef.current?.dispose();
      renderer3dRef.current = null;
    };
  }, []);

  // Initial 2D draw
  useEffect(() => {
    if (viewMode === '2d') draw2d();
  }, [viewMode]);

  const handleModeChange = useCallback((_: unknown, val: ViewMode | null) => {
    if (val) {
      if (renderer3dRef.current) {
        renderer3dRef.current.dispose();
        renderer3dRef.current = null;
      }
      setViewMode(val);
    }
  }, []);

  function draw2d() {
    const canvas = canvas2dRef.current;
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
    const cylinderTop = H * 0.06;
    const cylinderBottom = H * 0.56;
    const cylinderH = cylinderBottom - cylinderTop;
    const crankCenterY = H * 0.71;
    const crankRadius = cylinderH * 0.18;
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

    const chamberLeft = CX - cylinderW / 2 + wallThick;
    const chamberRight = CX + cylinderW / 2 - wallThick;
    const chamberW = chamberRight - chamberLeft;
    const chamberTop = cylinderTop + 18;

    drawChamberFill(ctx, chamberLeft, chamberTop, chamberW, pistonTop - chamberTop, phase, phaseProgress, isDark);

    ctx.strokeStyle = isDark ? '#9ca3af' : '#374151';
    ctx.lineWidth = wallThick;
    ctx.beginPath(); ctx.moveTo(CX - cylinderW / 2, cylinderTop); ctx.lineTo(CX - cylinderW / 2, cylinderBottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(CX + cylinderW / 2, cylinderTop); ctx.lineTo(CX + cylinderW / 2, cylinderBottom); ctx.stroke();

    ctx.fillStyle = isDark ? '#4b5563' : '#9ca3af';
    ctx.fillRect(CX - cylinderW / 2 - 8, cylinderTop - 8, cylinderW + 16, 18);
    ctx.strokeStyle = isDark ? '#6b7280' : '#6b7280';
    ctx.lineWidth = 2;
    ctx.strokeRect(CX - cylinderW / 2 - 8, cylinderTop - 8, cylinderW + 16, 18);

    ctx.fillStyle = isDark ? '#374151' : '#d1d5db';
    ctx.beginPath();
    ctx.moveTo(CX - cylinderW / 2 - 12, cylinderBottom);
    ctx.lineTo(CX + cylinderW / 2 + 12, cylinderBottom);
    ctx.lineTo(CX + cylinderW / 2 + 30, crankCenterY + crankRadius + 30);
    ctx.lineTo(CX - cylinderW / 2 - 30, crankCenterY + crankRadius + 30);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = isDark ? '#6b7280' : '#9ca3af'; ctx.lineWidth = 2; ctx.stroke();

    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = isDark ? '#6b7280' : '#9ca3af';
    ctx.lineWidth = 1;
    const tdcY = cylinderTop + cylinderH * 0.12;
    const bmiY = tdcY + pistonTravel;
    ctx.beginPath(); ctx.moveTo(CX - cylinderW / 2 - 20, tdcY); ctx.lineTo(CX + cylinderW / 2 + 20, tdcY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(CX - cylinderW / 2 - 20, bmiY); ctx.lineTo(CX + cylinderW / 2 + 20, bmiY); ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '10px sans-serif';
    ctx.fillStyle = isDark ? '#9ca3af' : '#6b7280';
    ctx.textAlign = 'right';
    ctx.fillText('PMS', CX - cylinderW / 2 - 24, tdcY + 4);
    ctx.fillText('PMI', CX - cylinderW / 2 - 24, bmiY + 4);

    drawValve(ctx, CX - cylinderW * 0.25, cylinderTop, phase === 'intake', 'intake', isDark);
    drawValve(ctx, CX + cylinderW * 0.25, cylinderTop, phase === 'exhaust', 'exhaust', isDark);
    drawSparkPlug(ctx, CX, cylinderTop, phase === 'power' && phaseProgress < 0.08, isDark);

    ctx.fillStyle = isDark ? '#6b7280' : '#71717a';
    const pistonLeft = CX - cylinderW / 2 + wallThick + 3;
    const pistonW = cylinderW - wallThick * 2 - 6;
    ctx.fillRect(pistonLeft, pistonTop, pistonW, pistonH);
    ctx.strokeStyle = isDark ? '#9ca3af' : '#52525b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pistonLeft, pistonTop, pistonW, pistonH);

    ctx.strokeStyle = isDark ? '#d1d5db' : '#3f3f46'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const ry = pistonTop + 4 + i * 6;
      ctx.beginPath(); ctx.moveTo(pistonLeft + 2, ry); ctx.lineTo(pistonLeft + pistonW - 2, ry); ctx.stroke();
    }

    ctx.fillStyle = isDark ? '#d1d5db' : '#52525b';
    ctx.beginPath(); ctx.arc(wristPinX, wristPinY, 5, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = isDark ? '#9ca3af' : '#52525b'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(wristPinX, wristPinY); ctx.lineTo(crankPinX, crankPinY); ctx.stroke();
    ctx.lineCap = 'butt';

    ctx.strokeStyle = isDark ? '#6b7280' : '#a1a1aa'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(CX, crankCenterY, crankRadius, 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = isDark ? '#f59e0b' : '#d97706';
    ctx.beginPath(); ctx.arc(crankPinX, crankPinY, 6, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = isDark ? '#9ca3af' : '#71717a';
    ctx.beginPath(); ctx.arc(CX, crankCenterY, 4, 0, Math.PI * 2); ctx.fill();

    drawGasAnimations(ctx, CX, cylinderW, chamberTop, pistonTop, phase, phaseProgress, isDark, t);
    drawProgressBar(ctx, W, H, t);
  }

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* View toggle */}
      <Box sx={{ position: 'absolute', top: 6, right: 6, zIndex: 10, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {viewMode === '3d' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, opacity: 0.5 }}>
            <ThreeSixtyIcon sx={{ fontSize: 14 }} />
            <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>Trascina per ruotare</Typography>
          </Box>
        )}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleModeChange}
          size="small"
          sx={{ bgcolor: 'background.paper', boxShadow: 1 }}
        >
          <ToggleButton value="2d" sx={{ px: 1, py: 0.25 }}>
            <GridOnIcon sx={{ fontSize: 16, mr: 0.5 }} />
            <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>2D</Typography>
          </ToggleButton>
          <ToggleButton value="3d" sx={{ px: 1, py: 0.25 }}>
            <ViewInArIcon sx={{ fontSize: 16, mr: 0.5 }} />
            <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>3D</Typography>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* 2D canvas */}
      <canvas
        ref={canvas2dRef}
        style={{ display: viewMode === '2d' ? 'block' : 'none', width: '100%', height: '100%' }}
      />

      {/* 3D container */}
      <div
        ref={container3dRef}
        style={{ display: viewMode === '3d' ? 'block' : 'none', width: '100%', height: '100%' }}
      />
    </Box>
  );
});

function pistonPosition(t: number): number {
  const tc = ((t % 1) + 1) % 1;
  const pi = Math.min(3, Math.floor(tc * 4));
  const pt = (tc * 4) - pi;
  switch (pi) {
    case 0: return pt; case 1: return 1 - pt; case 2: return pt; case 3: return 1 - pt;
    default: return 0;
  }
}

function drawChamberFill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, phase: Phase, progress: number, isDark: boolean) {
  if (h <= 0) return;
  let color: string;
  switch (phase) {
    case 'intake': color = isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.15)'; break;
    case 'compression': { const o = Math.floor(progress * 180); color = `rgba(${200 + Math.floor(progress * 55)},${130 - o * 0.5},0,${0.15 + progress * 0.2})`; break; }
    case 'power': color = progress < 0.1 ? (isDark ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.4)') : (() => { const f = Math.max(0, 1 - (progress - 0.1) / 0.9); return `rgba(239,${Math.floor(68 + (1 - f) * 100)},${Math.floor(68 + (1 - f) * 50)},${0.15 + f * 0.25})`; })(); break;
    case 'exhaust': color = isDark ? 'rgba(120,90,60,0.2)' : 'rgba(120,90,60,0.12)'; break;
  }
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawValve(ctx: CanvasRenderingContext2D, cx: number, headY: number, isOpen: boolean, side: 'intake' | 'exhaust', isDark: boolean) {
  const stemLen = 20, discW = 18, discH = 4;
  const openOffset = isOpen ? 12 : 0;
  const stemTop = headY - 8 - stemLen;
  const stemBottom = headY - 8 + openOffset;
  ctx.strokeStyle = isDark ? '#d1d5db' : '#52525b'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, stemTop); ctx.lineTo(cx, stemBottom); ctx.stroke();
  ctx.fillStyle = side === 'intake' ? (isDark ? '#3b82f6' : '#2563eb') : (isDark ? '#ef4444' : '#dc2626');
  ctx.beginPath(); ctx.ellipse(cx, stemBottom + discH / 2, discW / 2, discH / 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = isDark ? '#9ca3af' : '#374151'; ctx.lineWidth = 1; ctx.stroke();
}

function drawSparkPlug(ctx: CanvasRenderingContext2D, cx: number, headY: number, firing: boolean, isDark: boolean) {
  const top = headY - 28;
  ctx.fillStyle = isDark ? '#fbbf24' : '#d97706';
  ctx.fillRect(cx - 4, top, 8, 12);
  ctx.strokeStyle = isDark ? '#9ca3af' : '#6b7280'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, top + 12); ctx.lineTo(cx, headY - 2); ctx.stroke();
  if (firing) {
    const grad = ctx.createRadialGradient(cx, headY + 8, 0, cx, headY + 8, 30);
    grad.addColorStop(0, 'rgba(255,255,100,0.9)'); grad.addColorStop(0.4, 'rgba(255,160,0,0.5)'); grad.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, headY + 8, 30, 0, Math.PI * 2); ctx.fill();
  }
}

function drawGasAnimations(ctx: CanvasRenderingContext2D, CX: number, cylinderW: number, chamberTop: number, pistonTop: number, phase: Phase, progress: number, isDark: boolean, t: number) {
  const leftX = CX - cylinderW * 0.25, rightX = CX + cylinderW * 0.25;
  const chamberH = pistonTop - chamberTop;

  if (phase === 'intake') {
    ctx.strokeStyle = isDark ? '#60a5fa' : '#3b82f6'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const off = ((progress * 3 + i / 5) % 1); const ay = chamberTop - 30 + off * (chamberH + 20); if (ay > chamberTop && ay < pistonTop - 5) drawArrow(ctx, leftX, ay, 0, 8); }
    ctx.fillStyle = isDark ? 'rgba(96,165,250,0.6)' : 'rgba(59,130,246,0.5)';
    for (let i = 0; i < 12; i++) { const seed = i * 137.5 + t * 800; const px = CX + Math.sin(seed) * (cylinderW * 0.3) * progress; const py = chamberTop + ((seed * 0.1) % 1) * chamberH * progress; if (py < pistonTop - 3) { ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill(); } }
  }
  if (phase === 'compression') {
    ctx.fillStyle = isDark ? 'rgba(251,191,36,0.5)' : 'rgba(245,158,11,0.4)';
    const d = 8 + Math.floor(progress * 20);
    for (let i = 0; i < d; i++) { const s = i * 97.3; const px = CX + Math.sin(s) * cylinderW * 0.35; const py = chamberTop + (Math.cos(s * 0.7) * 0.5 + 0.5) * chamberH; if (py < pistonTop - 3 && py > chamberTop) { ctx.beginPath(); ctx.arc(px, py, 1.5 + progress, 0, Math.PI * 2); ctx.fill(); } }
  }
  if (phase === 'power' && progress < 0.15) {
    const flash = 1 - progress / 0.15;
    const grad = ctx.createRadialGradient(CX, chamberTop + 10, 0, CX, chamberTop + 10, 40 + progress * 100);
    grad.addColorStop(0, `rgba(255,255,100,${flash * 0.8})`); grad.addColorStop(0.5, `rgba(255,100,0,${flash * 0.4})`); grad.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(CX, chamberTop + 10, 40 + progress * 100, 0, Math.PI * 2); ctx.fill();
  }
  if (phase === 'exhaust') {
    ctx.strokeStyle = isDark ? 'rgba(168,162,158,0.6)' : 'rgba(120,113,108,0.5)'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const off = ((progress * 3 + i / 5) % 1); const ay = pistonTop - 10 - off * (chamberH + 20); if (ay > chamberTop && ay < pistonTop - 5) drawArrow(ctx, rightX, ay, Math.PI, 8); }
  }
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(0, size); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-4, size - 5); ctx.lineTo(0, size); ctx.lineTo(4, size - 5); ctx.stroke();
  ctx.restore();
}

function drawProgressBar(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
  const barY = H - 20, barH = 10, barW = W - 40, barX = 20;
  ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(barX, barY, barW, barH);
  const phases: Phase[] = ['intake', 'compression', 'power', 'exhaust'];
  for (let i = 0; i < 4; i++) {
    const segS = i / 4, segE = (i + 1) / 4, fillE = Math.min(segE, t);
    if (fillE > segS) { ctx.fillStyle = PHASE_COLORS[phases[i]]; ctx.fillRect(barX + segS * barW, barY, (fillE - segS) * barW, barH); }
  }
  ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 1; ctx.strokeRect(barX, barY, barW, barH);
  for (let i = 1; i < 4; i++) { const dx = barX + (i / 4) * barW; ctx.beginPath(); ctx.moveTo(dx, barY); ctx.lineTo(dx, barY + barH); ctx.stroke(); }
}

export default EngineCanvas;
