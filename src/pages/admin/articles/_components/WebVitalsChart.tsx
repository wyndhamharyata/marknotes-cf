import { useEffect, useRef } from "preact/hooks";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { tooltipPlugin } from "./uplot-tooltip";
import { BIRO, CHOP, INK, SIGNAL, axes } from "./chart-theme";

interface Props {
  ts: number[];
  lcp: (number | null)[];
  inp: (number | null)[];
  cls: (number | null)[];
  ttfb: (number | null)[];
}

const HEIGHT = 320;

type VitalKey = "lcp" | "inp" | "cls" | "ttfb";
// Matches the legend in Analytics.astro.
export const VITALS: Array<{ key: VitalKey; label: string; stroke: string; dash?: number[] }> = [
  { key: "lcp", label: "LCP", stroke: INK },
  { key: "inp", label: "INP", stroke: BIRO },
  { key: "cls", label: "CLS", stroke: SIGNAL, dash: [6, 4] },
  { key: "ttfb", label: "TTFB", stroke: CHOP },
];

export default function WebVitalsChart(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let chart: uPlot | null = null;

    const data: uPlot.AlignedData = [
      props.ts,
      props.lcp,
      props.inp,
      props.cls,
      props.ttfb,
    ] as uPlot.AlignedData;

    const buildOpts = (): uPlot.Options => {
      const series = VITALS;

      return {
        width: 0,
        height: HEIGHT,
        scales: {
          x: { time: true },
          y: { range: [0, 1], auto: false },
        },
        legend: { show: false },
        cursor: {
          drag: { x: true, y: false, setScale: false },
          points: { size: 8, fill: INK },
        },
        plugins: [
          tooltipPlugin((u, idx) =>
            series.map((s, i) => {
              const v = u.data[i + 1][idx];
              return {
                label: s.label,
                color: s.stroke,
                value: v == null ? "—" : `${(v * 100).toFixed(0)}%`,
              };
            })
          ),
        ],
        series: [
          { label: "Time" },
          ...series.map((s) => ({
            label: `${s.label} % good`,
            stroke: s.stroke,
            dash: s.dash,
            width: 2,
            spanGaps: false,
            points: { show: false },
          })),
        ],
        axes: axes((_u, vals) => vals.map((v) => `${Math.round(v * 100)}%`)),
      };
    };

    const initChart = (width: number) => {
      chart?.destroy();
      chart = new uPlot({ ...buildOpts(), width }, data, el);
    };

    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0].contentRect.width);
      if (w <= 0) return;
      if (!chart) {
        initChart(w);
      } else {
        chart.setSize({ width: w, height: HEIGHT });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart?.destroy();
      chart = null;
    };
  }, [props.ts, props.lcp, props.inp, props.cls, props.ttfb]);

  return <div ref={containerRef} class="w-full" style={{ minHeight: `${HEIGHT}px` }} />;
}
