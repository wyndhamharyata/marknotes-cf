const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function filterTableByDateRange(
  html: string,
  fromDate: Date,
  toDate: Date
): string {
  const fromMonth = fromDate.getMonth();
  const toMonth = toDate.getMonth();

  const ixRegex = /data-ix="(\d+)"[^>]*data-date="(\d{4}-\d{2}-\d{2})"/g;
  const validIx = new Set<string>();

  let match;

  while ((match = ixRegex.exec(html)) !== null) {
    const ix = match[1];
    const dateStr = match[2];
    const date = new Date(dateStr);

    if (date >= fromDate && date <= toDate) {
      validIx.add(ix);
    }
  }

  if (fromMonth === 0 && toMonth === 11) {
    return html;
  }

  let filtered = html;

  MONTH_NAMES.forEach((month, idx) => {
    if (idx < fromMonth || idx > toMonth) {
      const monthRegex = new RegExp(
        `<td[^>]*class="[^"]*ContributionCalendar-label[^"]*"[^>]*>[\\s\\S]*?<span[^>]*>${month}</span>[\\s\\S]*?</td>`,
        "g"
      );
      filtered = filtered.replace(monthRegex, "");
    }
  });

  filtered = filtered.replace(
    /<td[^>]*data-ix="(\d+)"[^>]*>[^<]*<\/td>\s*(?:<tool-tip[^>]*>[\s\S]*?<\/tool-tip>)?/g,
    (match, ix) => {
      if (ix && !validIx.has(ix)) {
        return "";
      }
      return match;
    }
  );

  filtered = filtered.replace(
    /<td[^>]*class="[^"]*ContributionCalendar-label[^"]*"[^>]*>[\s\S]*?<\/td>/g,
    (match) => {
      if (DAY_NAMES.some((day) => match.includes(day))) {
        return "";
      }
      return match;
    }
  );

  filtered = filtered.replace(
    /<td[^>]*>\s*<span class="sr-only">Day of Week<\/span>\s*<\/td>/g,
    ""
  );

  // Remove tabindex from td elements (accessibility: non-interactive elements shouldn't have tabindex)
  filtered = filtered.replace(/<td([^>]*)\stabindex="[^"]*"/g, "<td$1");

  return filtered;
}
