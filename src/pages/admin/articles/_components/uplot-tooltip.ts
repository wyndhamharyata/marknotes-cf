import type uPlot from "uplot";

export interface TooltipRow {
  label: string;
  color: string;
  value: string;
}

const TOOLTIP_STYLE = [
  "position: absolute",
  "pointer-events: none",
  "z-index: 10",
  "padding: 0.5rem 0.75rem",
  "background: var(--color-base-100, #fff)",
  "color: var(--color-base-content, #111)",
  "border: 1px solid var(--color-base-300, #e5e7eb)",
  "border-radius: 0.5rem",
  "box-shadow: 0 4px 14px rgba(0,0,0,0.18)",
  "font-size: 0.75rem",
  "line-height: 1.25",
  "white-space: nowrap",
  "display: none",
  "transform: translate(-50%, calc(-100% - 12px))",
  "transition: opacity 80ms ease-out",
].join(";");

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function tooltipPlugin(
  formatRows: (u: uPlot, idx: number) => TooltipRow[],
): uPlot.Plugin {
  let tooltip: HTMLDivElement;

  return {
    hooks: {
      init: (u) => {
        tooltip = document.createElement("div");
        tooltip.style.cssText = TOOLTIP_STYLE;
        u.over.appendChild(tooltip);
      },
      setCursor: (u) => {
        const { left, top, idx } = u.cursor;
        if (idx == null || left == null || top == null || left < 0 || top < 0) {
          tooltip.style.display = "none";
          return;
        }

        const ts = u.data[0][idx] as number;
        const timeStr = dateFmt.format(new Date(ts * 1000));
        const rows = formatRows(u, idx);

        const rowHtml = rows
          .map(
            (r) =>
              `<div style="display:flex;gap:0.5rem;align-items:center;margin-top:2px">
                <span style="display:inline-block;width:8px;height:8px;background:${r.color};border-radius:9999px;flex:none"></span>
                <span style="opacity:0.7">${r.label}</span>
                <span style="font-weight:600;margin-left:auto">${r.value}</span>
              </div>`,
          )
          .join("");

        tooltip.innerHTML =
          `<div style="font-weight:600;font-size:0.8125rem">${timeStr}</div>` + rowHtml;

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.display = "block";
      },
      destroy: () => {
        tooltip?.remove();
      },
    },
  };
}
