import { useEffect, useRef } from "preact/hooks";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { tooltipPlugin } from "./uplot-tooltip";
import { INK, axes, lastPoint } from "./chart-theme";

interface Props {
  ts: number[];
  pv7d: number[];
}

const HEIGHT = 280;

export default function PageviewsChart({ ts, pv7d }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let chart: uPlot | null = null;

    const data: uPlot.AlignedData = [ts, pv7d];

    const buildOpts = (): uPlot.Options => {
      return {
        width: 0,
        height: HEIGHT,
        scales: {
          x: { time: true },
          y: { auto: true },
        },
        legend: { show: false },
        cursor: {
          drag: { x: true, y: false, setScale: false },
          points: { size: 8, fill: INK },
        },
        plugins: [
          lastPoint,
          tooltipPlugin((u, idx) => [
            {
              label: "Pageviews (7d rolling)",
              color: INK,
              value: String(u.data[1][idx] ?? "—"),
            },
          ]),
        ],
        series: [
          { label: "Time" },
          {
            label: "Pageviews (7d rolling)",
            stroke: INK,
            width: 2,
            points: { show: false },
          },
        ],
        axes: axes((_u, vals) => vals.map((v) => `${v}`)),
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
  }, [ts, pv7d]);

  return <div ref={containerRef} class="w-full" style={{ minHeight: `${HEIGHT}px` }} />;
}
