import { useRef, useCallback, useEffect } from 'react';
import { buildPathArrays, cyclePoint, type CycleState, type PathArrays } from '../lib/thermodynamics';

export interface EngineLoopApi {
  paths: PathArrays;
  getState: () => CycleState;
  getT: () => number;
  setT: (t: number) => void;
  setPlaying: (p: boolean) => void;
  isPlaying: () => boolean;
  setSpeed: (s: number) => void;
  subscribe: (cb: FrameCallback) => void;
}

type FrameCallback = (state: CycleState, t: number) => void;

export function useEngineLoop(): EngineLoopApi {
  const pathsRef = useRef<PathArrays>(null!);
  if (pathsRef.current === null) {
    pathsRef.current = buildPathArrays();
  }

  const tRef = useRef(0);
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const cbRef = useRef<FrameCallback | null>(null);
  const rafRef = useRef(0);

  const tick = useCallback(() => {
    if (playingRef.current) {
      tRef.current = (tRef.current + 0.07 * speedRef.current * (1 / 60)) % 1;
    }
    const state = cyclePoint(tRef.current, pathsRef.current);
    cbRef.current?.(state, tRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  return {
    paths: pathsRef.current,
    getState: () => cyclePoint(tRef.current, pathsRef.current),
    getT: () => tRef.current,
    setT: (t: number) => { tRef.current = ((t % 1) + 1) % 1; },
    setPlaying: (p: boolean) => { playingRef.current = p; },
    isPlaying: () => playingRef.current,
    setSpeed: (s: number) => { speedRef.current = s; },
    subscribe: (cb: FrameCallback) => { cbRef.current = cb; },
  };
}
