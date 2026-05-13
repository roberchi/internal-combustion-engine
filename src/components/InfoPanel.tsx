import { forwardRef, useImperativeHandle, useRef } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CompressIcon from '@mui/icons-material/Compress';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import BoltIcon from '@mui/icons-material/Bolt';
import type { CycleState } from '../lib/thermodynamics';
import { PHASE_LABELS, PHASE_DESCRIPTIONS, PHASE_COLORS, workExchangeLabel } from '../lib/thermodynamics';

export interface InfoPanelHandle {
  update: (state: CycleState) => void;
}

const InfoPanel = forwardRef<InfoPanelHandle>(function InfoPanel(_, ref) {
  const pressureRef = useRef<HTMLSpanElement>(null);
  const tempRef = useRef<HTMLSpanElement>(null);
  const volumeRef = useRef<HTMLSpanElement>(null);
  const workRef = useRef<HTMLSpanElement>(null);
  const phaseNameRef = useRef<HTMLSpanElement>(null);
  const phaseDescRef = useRef<HTMLParagraphElement>(null);
  const balloonRef = useRef<HTMLDivElement>(null);
  const lastPhaseRef = useRef<string>('');

  useImperativeHandle(ref, () => ({
    update(state: CycleState) {
      if (pressureRef.current) pressureRef.current.textContent = `${state.P.toFixed(2)} P₀`;
      if (tempRef.current) tempRef.current.textContent = `${state.T.toFixed(0)} K`;
      if (volumeRef.current) volumeRef.current.textContent = `${state.V.toFixed(3)} V₀`;
      if (workRef.current) workRef.current.textContent = workExchangeLabel(state.phase);

      if (state.phase !== lastPhaseRef.current) {
        lastPhaseRef.current = state.phase;
        if (phaseNameRef.current) phaseNameRef.current.textContent = PHASE_LABELS[state.phase];
        if (phaseDescRef.current) phaseDescRef.current.textContent = PHASE_DESCRIPTIONS[state.phase];
        if (balloonRef.current) balloonRef.current.style.borderLeftColor = PHASE_COLORS[state.phase];
      }
    },
  }));

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'stretch', flexDirection: { xs: 'column', md: 'row' } }}>
      {/* Metric cards row */}
      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, flexWrap: 'wrap' }}>
        <MetricCard icon={<CompressIcon sx={{ fontSize: 16, color: '#ef4444' }} />} label="Pressione" refSpan={pressureRef} defaultVal="1.00 P₀" />
        <MetricCard icon={<ThermostatIcon sx={{ fontSize: 16, color: '#f59e0b' }} />} label="Temperatura" refSpan={tempRef} defaultVal="300 K" />
        <MetricCard icon={<ViewInArIcon sx={{ fontSize: 16, color: '#3b82f6' }} />} label="Volume" refSpan={volumeRef} defaultVal="1.000 V₀" />
        <MetricCard icon={<BoltIcon sx={{ fontSize: 16, color: '#8b5cf6' }} />} label="W / Q" refSpan={workRef} defaultVal="—" />
      </Box>

      {/* Phase description balloon */}
      <Paper
        ref={balloonRef}
        variant="outlined"
        sx={{
          flex: 1,
          borderLeft: 4,
          borderLeftColor: PHASE_COLORS.intake,
          borderRadius: 2,
          px: 1.5,
          py: 0.5,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minWidth: 0,
        }}
      >
        <Chip
          label={<span ref={phaseNameRef}>{PHASE_LABELS.intake}</span>}
          size="small"
          sx={{ alignSelf: 'flex-start', fontWeight: 700, fontSize: '0.65rem', mb: 0.5 }}
        />
        <Typography ref={phaseDescRef} variant="body2" sx={{ fontSize: '0.75rem', lineHeight: 1.4 }}>
          {PHASE_DESCRIPTIONS.intake}
        </Typography>
      </Paper>
    </Box>
  );
});

function MetricCard({ icon, label, refSpan, defaultVal }: {
  icon: React.ReactNode;
  label: string;
  refSpan: React.RefObject<HTMLSpanElement | null>;
  defaultVal: string;
}) {
  return (
    <Paper variant="outlined" sx={{
      px: 1.5, py: 0.5, textAlign: 'center', borderRadius: 2, minWidth: 90,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {icon}
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Typography>
      </Box>
      <Typography component="span" ref={refSpan} sx={{ fontWeight: 700, fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
        {defaultVal}
      </Typography>
    </Paper>
  );
}

export default InfoPanel;
