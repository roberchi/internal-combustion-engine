import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import type { PathArrays, CycleState } from '../lib/thermodynamics';
import { PHASE_COLORS } from '../lib/thermodynamics';

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend);

type Tab = 'PV' | 'PT' | 'TV';

export interface DiagramPanelHandle {
  update: (state: CycleState) => void;
}

interface Props {
  paths: PathArrays;
}

function makeXY(paths: PathArrays, xKey: keyof CycleState, yKey: keyof CycleState) {
  const phases = ['intake', 'compression', 'power', 'exhaust'] as const;
  return phases.map((p) => ({
    label: p,
    data: paths[p].map((pt) => ({ x: pt[xKey] as number, y: pt[yKey] as number })),
    borderColor: PHASE_COLORS[p],
    backgroundColor: 'transparent',
    showLine: true,
    pointRadius: 0,
    borderWidth: 2,
  }));
}

function makeDotDataset() {
  return {
    label: 'current',
    data: [{ x: 0, y: 0 }],
    borderColor: '#ffffff',
    backgroundColor: '#111827',
    pointRadius: 7,
    pointBorderWidth: 2,
    showLine: false,
  };
}

function buildChartData(paths: PathArrays, tab: Tab): ChartData<'scatter'> {
  let datasets;
  switch (tab) {
    case 'PV': datasets = makeXY(paths, 'V', 'P'); break;
    case 'PT': datasets = makeXY(paths, 'T', 'P'); break;
    case 'TV': datasets = makeXY(paths, 'V', 'T'); break;
  }
  datasets.push(makeDotDataset());
  return { datasets };
}

function buildOptions(tab: Tab): ChartOptions<'scatter'> {
  const labels: Record<Tab, { x: string; y: string }> = {
    PV: { x: 'Volume (V/V₀)', y: 'Pressione (P/P₀)' },
    PT: { x: 'Temperatura (K)', y: 'Pressione (P/P₀)' },
    TV: { x: 'Volume (V/V₀)', y: 'Temperatura (K)' },
  };
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: {
        title: { display: true, text: labels[tab].x, font: { size: 11 } },
        grid: { color: 'rgba(128,128,128,0.15)' },
        ticks: { font: { size: 10 } },
      },
      y: {
        title: { display: true, text: labels[tab].y, font: { size: 11 } },
        grid: { color: 'rgba(128,128,128,0.15)' },
        ticks: { font: { size: 10 } },
      },
    },
  };
}

const DiagramPanel = forwardRef<DiagramPanelHandle, Props>(function DiagramPanel({ paths }, ref) {
  const [tab, setTab] = useState<Tab>('PV');
  const chartRef = useRef<ChartJS<'scatter'> | null>(null);

  const pvData = useRef(buildChartData(paths, 'PV'));
  const ptData = useRef(buildChartData(paths, 'PT'));
  const tvData = useRef(buildChartData(paths, 'TV'));

  const currentDataRef = useRef(pvData);
  useEffect(() => {
    switch (tab) {
      case 'PV': currentDataRef.current = pvData; break;
      case 'PT': currentDataRef.current = ptData; break;
      case 'TV': currentDataRef.current = tvData; break;
    }
  }, [tab]);

  useImperativeHandle(ref, () => ({
    update(state: CycleState) {
      const chart = chartRef.current;
      if (!chart) return;
      const dotIdx = chart.data.datasets.length - 1;
      let x: number, y: number;
      switch (tab) {
        case 'PV': x = state.V; y = state.P; break;
        case 'PT': x = state.T; y = state.P; break;
        case 'TV': x = state.V; y = state.T; break;
      }
      chart.data.datasets[dotIdx].data = [{ x, y }];
      chart.data.datasets[dotIdx].backgroundColor = PHASE_COLORS[state.phase];
      chart.update('none');
    },
  }), [tab]);

  const dataForTab = tab === 'PV' ? pvData.current : tab === 'PT' ? ptData.current : tvData.current;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ToggleButtonGroup
        value={tab}
        exclusive
        onChange={(_, v) => v && setTab(v)}
        size="small"
        sx={{ mb: 0.5, alignSelf: 'flex-start' }}
      >
        <ToggleButton value="PV" sx={{ px: 1.5, py: 0.25, fontSize: '0.75rem' }}>P–V</ToggleButton>
        <ToggleButton value="PT" sx={{ px: 1.5, py: 0.25, fontSize: '0.75rem' }}>P–T</ToggleButton>
        <ToggleButton value="TV" sx={{ px: 1.5, py: 0.25, fontSize: '0.75rem' }}>T–V</ToggleButton>
      </ToggleButtonGroup>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <Scatter
          ref={(r) => { chartRef.current = r ?? null; }}
          data={dataForTab}
          options={buildOptions(tab)}
        />
      </Box>
    </Box>
  );
});

export default DiagramPanel;
