import { useEffect, useRef } from "preact/hooks";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { tooltipPlugin } from "./uplot-tooltip";

interface Props {
  ts: number[];
  pv7d: number[];
}

const STROKE = "#3b82f6";

const HEIGHT = 280;

export default function PageviewsChart({ ts, pv7d }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let chart: uPlot | null = null;

    const data: uPlot.AlignedData = [ts, pv7d];

    const opts: uPlot.Options = {
      width: 0,
      height: HEIGHT,
      scales: {
        x: { time: true },
        y: { auto: true },
      },
      legend: { show: false },
      cursor: {
        drag: { x: true, y: false, setScale: false },
        points: { size: 8 },
      },
      plugins: [
        tooltipPlugin((u, idx) => [
          {
            label: "Pageviews (7d rolling)",
            color: STROKE,
            value: String(u.data[1][idx] ?? "—"),
          },
        ]),
      ],
      series: [
        { label: "Time" },
        {
          label: "Pageviews (7d rolling)",
          stroke: STROKE,
          width: 2,
          fill: "rgba(59,130,246,0.12)",
          points: { show: false },
        },
      ],
      axes: [
        { stroke: "currentColor" },
        {
          stroke: "currentColor",
          values: (_u, vals) => vals.map((v) => `${v}`),
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
  }, [ts, pv7d]);

  return <div ref={containerRef} class="w-full" style={{ minHeight: `${HEIGHT}px` }} />;
}
