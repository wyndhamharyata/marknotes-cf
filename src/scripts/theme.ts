function initTheme() {
  const toggle = document.getElementById("dark-toggle") as HTMLInputElement | null;

  // Check for saved preference or system preference
  const savedTheme = localStorage.getItem("dark-mode");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = savedTheme === "true" || (savedTheme === null && prefersDark);

  // Apply theme
  updateTheme(isDark);

  // If toggle exists, sync it
  if (toggle) {
    toggle.checked = isDark;
    toggle.addEventListener("change", () => {
      const isDark = toggle.checked;
      localStorage.setItem("dark-mode", String(isDark));
      updateTheme(isDark);
    });
  }
}

function updateTheme(isDark: boolean) {
  const html = document.documentElement;
  if (isDark) {
    html.classList.add("dark");
    html.setAttribute("data-theme", "marknotes-dark");
  } else {
    html.classList.remove("dark");
    html.setAttribute("data-theme", "marknotes-light");
  }
}

// Run on initial load
initTheme();

// Re-run on htmx page swaps
document.addEventListener("htmx:afterSettle", initTheme);
