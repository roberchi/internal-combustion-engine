# Motore a Combustione Interna — Ciclo Otto

Simulazione interattiva e didattica di un motore a combustione interna a 4 tempi (ciclo Otto), pensata per studenti italiani del triennio del liceo scientifico.

L'applicazione mostra in tempo reale il funzionamento meccanico del motore e le trasformazioni termodinamiche associate a ciascuna fase del ciclo, con animazioni sincronizzate e spiegazioni in italiano.

## Funzionalità

### Visualizzazione del motore (Canvas HTML5)
- Sezione trasversale di un cilindro singolo con testata, pareti, carter
- Pistone con segmenti, spinotto e biella collegata all'albero motore rotante
- Valvola di aspirazione (sinistra) e valvola di scarico (destra) che si aprono/chiudono nella fase corretta
- Candela con effetto scintilla e fiamma durante la fase di scoppio
- Animazioni dei gas: flusso aria-combustibile in aspirazione, particelle in compressione, esplosione radiale allo scoppio, gas di scarico in uscita
- Colorazione della camera: blu (aspirazione), arancione (compressione), rosso (scoppio), marrone (scarico)
- Linee di riferimento PMS (punto morto superiore) e PMI (punto morto inferiore)
- Barra di avanzamento del ciclo con colori per fase

### Diagrammi termodinamici (Chart.js)
Tre grafici selezionabili tramite tab, ciascuno con 4 curve colorate (una per fase) e un punto mobile che traccia lo stato corrente:
- **P–V** (Pressione–Volume): ciclo Otto classico
- **P–T** (Pressione–Temperatura)
- **T–V** (Temperatura–Volume)

### Pannello informativo
- 4 schede metriche aggiornate in tempo reale: Pressione, Temperatura, Volume, Lavoro/Calore
- Descrizione in italiano della fase corrente con spiegazione della trasformazione termodinamica

### Controlli
- Play/Pausa con icona
- Slider di avanzamento per scorrere manualmente il ciclo
- Controllo velocità (da ×1 a ×6)
- Pulsanti di salto rapido alle 4 fasi: Aspirazione, Compressione, Scoppio, Scarico

## Modello termodinamico

Il ciclo Otto è modellato con i seguenti parametri:

| Parametro | Valore |
|-----------|--------|
| Rapporto di compressione (r) | 9 |
| Indice adiabatico (γ) | 1.4 |
| Rapporto di adduzione calore | 2.5 |
| T₁ (temperatura iniziale) | 300 K |
| P₁ (pressione iniziale) | 1 bar (riferimento) |

Le 4 fasi:
1. **Aspirazione** — espansione isobara a P₁
2. **Compressione** — compressione adiabatica (P·V^γ = cost.)
3. **Scoppio** — combustione isocora + espansione adiabatica
4. **Scarico** — calo isocoro di pressione + espulsione isobara

## Tech stack

- **Vite** + **React 18** + **TypeScript**
- **Material UI (MUI)** per i componenti UI e le icone
- **Tailwind CSS v3** per utilità di stile
- **Chart.js** + **react-chartjs-2** per i diagrammi
- **HTML5 Canvas** per il disegno del motore
- Deploy su **Vercel**

## Avvio in locale

```bash
npm install
npm run dev
```

## Build di produzione

```bash
npm run build
npm run preview
```

## Struttura del progetto

```
src/
├── main.tsx                        # Entry point
├── App.tsx                         # Layout principale con MUI theme
├── hooks/
│   └── useEngineLoop.ts            # Loop requestAnimationFrame e API
├── components/
│   ├── EngineCanvas.tsx            # Disegno del motore su canvas
│   ├── DiagramPanel.tsx            # Grafici P-V, P-T, T-V
│   ├── InfoPanel.tsx               # Metriche e descrizione fase
│   └── Controls.tsx                # Slider, play/pausa, velocità, fasi
├── lib/
│   └── thermodynamics.ts           # Modello termodinamico e costanti
└── styles/
    └── index.css                   # Direttive Tailwind
```

## Licenza

Progetto didattico.
