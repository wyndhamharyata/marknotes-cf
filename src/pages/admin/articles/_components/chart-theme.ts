export interface ChartTheme {
  primary: string;
  info: string;
  success: string;
  warning: string;
  accent: string;
  axisText: string;
  grid: string;
  fillPrimary: string;
}

export function readChartTheme(el: HTMLElement): ChartTheme {
  const cs = getComputedStyle(el);
  const get = (name: string) => cs.getPropertyValue(name).trim();
  const primary = get("--color-primary");
  const baseContent = get("--color-base-content");
  return {
    primary,
    info: get("--color-info"),
    success: get("--color-success"),
    warning: get("--color-warning"),
    accent: get("--color-accent"),
    axisText: baseContent,
    grid: `color-mix(in oklch, ${baseContent} 12%, transparent)`,
    fillPrimary: `color-mix(in oklch, ${primary} 14%, transparent)`,
  };
}
