// html.dark is any night; html.black adds the black stock of the dark theme.
const themes = ["light", "dim", "dark"] as const;

function current(): (typeof themes)[number] {
  const root = document.documentElement.classList;
  return root.contains("black") ? "dark" : root.contains("dark") ? "dim" : "light";
}

document.addEventListener("click", (e) => {
  const key = (e.target as Element).closest("#night-key");
  if (!key) return;
  const next = themes[(themes.indexOf(current()) + 1) % themes.length];
  localStorage.setItem("theme", next);
  document.documentElement.classList.toggle("dark", next !== "light");
  document.documentElement.classList.toggle("black", next === "dark");
  syncKey();
});

function syncKey() {
  const key = document.getElementById("night-key");
  const label = `Theme: ${current()}`;
  key?.setAttribute("aria-label", label);
  key?.setAttribute("title", label);
}

syncKey();

document.addEventListener("htmx:afterSettle", syncKey);
