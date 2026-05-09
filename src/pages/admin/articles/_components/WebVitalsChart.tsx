import { useEffect, useRef } from "preact/hooks";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { tooltipPlugin } from "./uplot-tooltip";
import { readChartTheme, type ChartTheme } from "./chart-theme";

interface Props {
  ts: number[];
  lcp: (number | null)[];
  inp: (number | null)[];
  cls: (number | null)[];
  ttfb: (number | null)[];
}

const HEIGHT = 320;

type VitalKey = "lcp" | "inp" | "cls" | "ttfb";
const VITALS: Array<{ key: VitalKey; label: string; themeColor: keyof ChartTheme }> = [
  { key: "lcp", label: "LCP", themeColor: "info" },
  { key: "inp", label: "INP", themeColor: "success" },
  { key: "cls", label: "CLS", themeColor: "warning" },
  { key: "ttfb", label: "TTFB", themeColor: "accent" },
];

export default function WebVitalsChart(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let chart: uPlot | null = null;
    let lastWidth = 0;

    const data: uPlot.AlignedData = [
      props.ts,
      props.lcp,
      props.inp,
      props.cls,
      props.ttfb,
    ] as uPlot.AlignedData;

    const buildOpts = (): uPlot.Options => {
      const theme = readChartTheme(el);
      const series = VITALS.map((v) => ({ ...v, stroke: theme[v.themeColor] }));

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
          points: { size: 8 },
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
            }),
          ),
        ],
        series: [
          { label: "Time" },
          ...series.map((s) => ({
            label: `${s.label} % good`,
            stroke: s.stroke,
            width: 2,
            spanGaps: false,
            points: { show: false },
          })),
        ],
        axes: [
          { stroke: theme.axisText, grid: { stroke: theme.grid } },
          {
            stroke: theme.axisText,
            grid: { stroke: theme.grid },
            values: (_u, vals) => vals.map((v) => `${Math.round(v * 100)}%`),
          },
        ],
      };
    };

    const initChart = (width: number) => {
      chart?.destroy();
      chart = new uPlot({ ...buildOpts(), width }, data, el);
      lastWidth = width;
    };

    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0].contentRect.width);
      if (w <= 0) return;
      if (!chart) {
        initChart(w);
      } else {
        chart.setSize({ width: w, height: HEIGHT });
        lastWidth = w;
      }
    });
    ro.observe(el);

    const themeObserver = new MutationObserver(() => {
      if (lastWidth > 0) initChart(lastWidth);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    return () => {
      ro.disconnect();
      themeObserver.disconnect();
      chart?.destroy();
      chart = null;
    };
  }, [props.ts, props.lcp, props.inp, props.cls, props.ttfb]);

  return <div ref={containerRef} class="w-full" style={{ minHeight: `${HEIGHT}px` }} />;
}
