document.addEventListener("click", (e) => {
  const key = (e.target as Element).closest("#night-key");
  if (!key) return;
  const isDark = !document.documentElement.classList.contains("dark");
  localStorage.setItem("dark-mode", String(isDark));
  document.documentElement.classList.toggle("dark", isDark);
  syncKey();
});

function syncKey() {
  const key = document.getElementById("night-key");
  key?.setAttribute("aria-pressed", String(document.documentElement.classList.contains("dark")));
}

syncKey();

document.addEventListener("htmx:afterSettle", syncKey);
