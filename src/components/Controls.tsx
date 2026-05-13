import { useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SpeedIcon from '@mui/icons-material/Speed';
import type { EngineLoopApi } from '../hooks/useEngineLoop';
import { PHASE_COLORS, type Phase } from '../lib/thermodynamics';

export interface ControlsHandle {
  updateScrub: (t: number) => void;
}

interface Props {
  api: EngineLoopApi;
}

const PHASE_PILLS: { phase: Phase; label: string; start: number }[] = [
  { phase: 'intake', label: 'Aspirazione', start: 0 },
  { phase: 'compression', label: 'Compressione', start: 0.25 },
  { phase: 'power', label: 'Scoppio', start: 0.5 },
  { phase: 'exhaust', label: 'Scarico', start: 0.75 },
];

const Controls = forwardRef<ControlsHandle, Props>(function Controls({ api }, ref) {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const sliderRef = useRef<HTMLInputElement>(null);
  const draggingRef = useRef(false);

  useImperativeHandle(ref, () => ({
    updateScrub(t: number) {
      if (!draggingRef.current && sliderRef.current) {
        sliderRef.current.value = String(Math.round(t * 1000));
      }
    },
  }));

  const handlePlayPause = useCallback(() => {
    const next = !playing;
    setPlaying(next);
    api.setPlaying(next);
  }, [playing, api]);

  const handleScrubInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const val = parseFloat((e.target as HTMLInputElement).value) / 1000;
    api.setPlaying(false);
    setPlaying(false);
    api.setT(val);
  }, [api]);

  const handleScrubStart = useCallback(() => { draggingRef.current = true; }, []);
  const handleScrubEnd = useCallback(() => { draggingRef.current = false; }, []);

  const handleSpeed = useCallback((_: unknown, val: number | number[]) => {
    const s = val as number;
    setSpeed(s);
    api.setSpeed(s);
  }, [api]);

  const handlePhaseJump = useCallback((start: number) => {
    api.setT(start);
    if (sliderRef.current) sliderRef.current.value = String(Math.round(start * 1000));
  }, [api]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Tooltip title={playing ? 'Pausa' : 'Avvia'}>
        <IconButton onClick={handlePlayPause} color="primary" size="small">
          {playing ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
      </Tooltip>

      <input
        ref={sliderRef}
        type="range"
        min={0}
        max={999}
        defaultValue={0}
        onInput={handleScrubInput}
        onMouseDown={handleScrubStart}
        onMouseUp={handleScrubEnd}
        onTouchStart={handleScrubStart}
        onTouchEnd={handleScrubEnd}
        style={{ flex: 1, minWidth: 120, accentColor: '#1976d2', height: 4, cursor: 'pointer' }}
      />

      <SpeedIcon fontSize="small" sx={{ color: 'text.secondary', ml: 1 }} />
      <Slider
        size="small"
        min={1}
        max={6}
        step={0.5}
        value={speed}
        onChange={handleSpeed}
        valueLabelDisplay="auto"
        valueLabelFormat={(v) => `×${v}`}
        sx={{ width: 80 }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 30 }}>
        &times;{speed.toFixed(1)}
      </Typography>

      <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
        {PHASE_PILLS.map(({ phase, label, start }) => (
          <Chip
            key={phase}
            label={label}
            size="small"
            onClick={() => handlePhaseJump(start)}
            sx={{
              bgcolor: PHASE_COLORS[phase],
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.7rem',
              '&:hover': { opacity: 0.85 },
            }}
          />
        ))}
      </Box>
    </Box>
  );
});

export default Controls;
