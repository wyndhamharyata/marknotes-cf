const parts = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
  // A frontmatter date is midnight where the site was built (here, UTC+7); printed in UTC it fell a day early.
  timeZone: "Asia/Jakarta",
});

/** "22 Jun 2025", the day as it was in Solo. */
export function formatDate(date: Date): string {
  const { day, month, year } = Object.fromEntries(
    parts.formatToParts(date).map(({ type, value }) => [type, value])
  );
  return `${day} ${month} ${year}`;
}
