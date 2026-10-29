import type uPlot from "uplot";

// Plotted in ink on graph paper; the paper and its grid are the container's background, and
// the inks hold at night, so nothing here reads the theme.
export const INK = "#141414";
export const BIRO = "#1E3FD9";
export const SIGNAL = "#FF5A1F";
export const CHOP = "#B80F2A";

const FONT = '12px "Atkinson Hyperlegible Mono", ui-monospace, monospace';

export function axes(yValues: uPlot.Axis["values"]): uPlot.Axis[] {
  const axis = { stroke: "#4D4D4D", font: FONT, grid: { show: false }, ticks: { stroke: INK } };
  return [axis, { ...axis, values: yValues }];
}

/** Today's point: an orange square at the end of the first series. */
export const lastPoint: uPlot.Plugin = {
  hooks: {
    draw: [
      (u) => {
        const i = u.data[0].length - 1;
        const value = u.data[1][i];
        if (value == null) return;
        const x = u.valToPos(u.data[0][i], "x", true);
        const y = u.valToPos(value, "y", true);
        const size = 14 * devicePixelRatio;
        u.ctx.fillStyle = SIGNAL;
        u.ctx.strokeStyle = INK;
        u.ctx.lineWidth = 1.5 * devicePixelRatio;
        u.ctx.fillRect(x - size / 2, y - size / 2, size, size);
        u.ctx.strokeRect(x - size / 2, y - size / 2, size, size);
      },
    ],
  },
};
