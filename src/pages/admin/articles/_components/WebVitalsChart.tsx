import { useEffect, useRef } from "preact/hooks";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { tooltipPlugin } from "./uplot-tooltip";

interface Props {
  ts: number[];
  lcp: (number | null)[];
  inp: (number | null)[];
  cls: (number | null)[];
  ttfb: (number | null)[];
}

const HEIGHT = 320;

const SERIES: Array<{ key: keyof Omit<Props, "ts">; label: string; stroke: string }> = [
  { key: "lcp", label: "LCP", stroke: "#3b82f6" },
  { key: "inp", label: "INP", stroke: "#10b981" },
  { key: "cls", label: "CLS", stroke: "#f59e0b" },
  { key: "ttfb", label: "TTFB", stroke: "#8b5cf6" },
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

    const opts: uPlot.Options = {
      width: 0,
      height: HEIGHT,
      scales: {
        x: { time: true },
        y: { range: [0, 1], auto: false },
      },
      legend: { show: false },
      cursor: {
        drag: { x: true, y: false, setScale: false },
        points: { size: 8 },
      },
      plugins: [
        tooltipPlugin((u, idx) =>
          SERIES.map((s, i) => {
            const v = u.data[i + 1][idx];
            return {
              label: s.label,
              color: s.stroke,
              value: v == null ? "—" : `${(v * 100).toFixed(0)}%`,
            };
          }),
        ),
      ],
      series: [
        { label: "Time" },
        ...SERIES.map((s) => ({
          label: `${s.label} % good`,
          stroke: s.stroke,
          width: 2,
          spanGaps: false,
          points: { show: false },
        })),
      ],
      axes: [
        { stroke: "currentColor" },
        {
          stroke: "currentColor",
          values: (_u, vals) => vals.map((v) => `${Math.round(v * 100)}%`),
        },
      ],
    };

    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0].contentRect.width);
      if (w <= 0) return;
      if (!chart) {
        chart = new uPlot({ ...opts, width: w }, data, el);
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
