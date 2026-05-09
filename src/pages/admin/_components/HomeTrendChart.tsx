import { useEffect, useRef } from "preact/hooks";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { tooltipPlugin } from "../articles/_components/uplot-tooltip";
import { readChartTheme } from "../articles/_components/chart-theme";

interface Props {
  ts: number[];
  pv: number[];
}

const HEIGHT = 280;

export default function HomeTrendChart({ ts, pv }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let chart: uPlot | null = null;
    let lastWidth = 0;

    const data: uPlot.AlignedData = [ts, pv];

    const buildOpts = (): uPlot.Options => {
      const theme = readChartTheme(el);
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
          points: { size: 8 },
        },
        plugins: [
          tooltipPlugin((u, idx) => [
            {
              label: "Pageviews (24h rolling)",
              color: theme.primary,
              value: String(u.data[1][idx] ?? "—"),
            },
          ]),
        ],
        series: [
          { label: "Time" },
          {
            label: "Pageviews (24h rolling)",
            stroke: theme.primary,
            width: 2,
            fill: theme.fillPrimary,
            points: { show: false },
          },
        ],
        axes: [
          { stroke: theme.axisText, grid: { stroke: theme.grid } },
          {
            stroke: theme.axisText,
            grid: { stroke: theme.grid },
            values: (_u, vals) => vals.map((v) => `${v}`),
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
  }, [ts, pv]);

  return <div ref={containerRef} class="w-full" style={{ minHeight: `${HEIGHT}px` }} />;
}
