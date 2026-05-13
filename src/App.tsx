import { useRef, useEffect, useMemo } from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import SettingsIcon from '@mui/icons-material/Settings';
import { useEngineLoop } from './hooks/useEngineLoop';
import EngineCanvas, { type EngineCanvasHandle } from './components/EngineCanvas';
import DiagramPanel, { type DiagramPanelHandle } from './components/DiagramPanel';
import InfoPanel, { type InfoPanelHandle } from './components/InfoPanel';
import Controls, { type ControlsHandle } from './components/Controls';

export default function App() {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = useMemo(() => createTheme({
    palette: { mode: prefersDark ? 'dark' : 'light' },
    typography: { fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif' },
  }), [prefersDark]);

  const api = useEngineLoop();
  const canvasRef = useRef<EngineCanvasHandle>(null);
  const diagramRef = useRef<DiagramPanelHandle>(null);
  const infoRef = useRef<InfoPanelHandle>(null);
  const controlsRef = useRef<ControlsHandle>(null);

  useEffect(() => {
    api.subscribe((state, t) => {
      canvasRef.current?.update(state, t);
      diagramRef.current?.update(state);
      infoRef.current?.update(state);
      controlsRef.current?.updateScrub(t);
    });
  }, [api]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        p: 1.5,
        gap: 1,
        overflow: 'hidden',
        maxWidth: 1600,
        mx: 'auto',
      }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, flexShrink: 0 }}>
          <SettingsIcon sx={{ color: 'primary.main', fontSize: 28 }} />
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
              Motore a Combustione Interna &mdash; Ciclo Otto
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Simulazione interattiva del ciclo a 4 tempi
            </Typography>
          </Box>
        </Box>

        {/* Controls — right below the title */}
        <Paper variant="outlined" sx={{ p: 1, flexShrink: 0, borderRadius: 2 }}>
          <Controls ref={controlsRef} api={api} />
        </Paper>

        {/* Main content: engine + diagram side by side */}
        <Box sx={{ flex: 1, display: 'flex', gap: 1, minHeight: 0, flexDirection: { xs: 'column', md: 'row' } }}>
          <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: 'hidden', borderRadius: 2 }}>
            <EngineCanvas ref={canvasRef} />
          </Paper>
          <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: 'hidden', borderRadius: 2, p: 1, display: 'flex', flexDirection: 'column' }}>
            <DiagramPanel ref={diagramRef} paths={api.paths} />
          </Paper>
        </Box>

        {/* Info panel at the bottom — compact */}
        <Paper variant="outlined" sx={{ p: 1, flexShrink: 0, borderRadius: 2 }}>
          <InfoPanel ref={infoRef} />
        </Paper>
      </Box>
    </ThemeProvider>
  );
}
