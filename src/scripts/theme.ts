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

document.addEventListener("change", (e) => {
  const target = e.target as HTMLInputElement;
  if (target.id === "dark-toggle") {
    const isDark = target.checked;
    localStorage.setItem("dark-mode", String(isDark));
    updateTheme(isDark);
  }
});

function syncToggle() {
  const toggle = document.getElementById("dark-toggle") as HTMLInputElement | null;
  if (toggle) {
    toggle.checked = document.documentElement.classList.contains("dark");
  }
}

syncToggle();

document.addEventListener("htmx:afterSettle", syncToggle);
