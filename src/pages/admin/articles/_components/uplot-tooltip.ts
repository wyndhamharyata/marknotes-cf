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
  "padding: 8px 12px",
  "background: var(--thermal)",
  "color: #141414",
  "border: 1px solid rgb(31 31 31 / .45)",
  "box-shadow: 0 6px 10px -4px rgba(0,0,0,0.3)",
  "font: 400 12px/1.25 var(--font-mono)",
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

export function tooltipPlugin(formatRows: (u: uPlot, idx: number) => TooltipRow[]): uPlot.Plugin {
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
                <span style="display:inline-block;width:8px;height:8px;background:${r.color};flex:none"></span>
                <span>${r.label}</span>
                <span style="font-weight:700;margin-left:auto">${r.value}</span>
              </div>`
          )
          .join("");

        tooltip.innerHTML = `<div style="font-weight:700">${timeStr}</div>` + rowHtml;

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
