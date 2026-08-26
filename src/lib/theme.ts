// Flip between light and dark. An unset data-theme means the app is following the OS, so resolve the
// current scheme from the media query first to know which way to go. Mirrors the mechanism in
// theme-toggle.tsx and the pre-paint script in layout.tsx (localStorage key 'theme', data-theme on <html>).
export function toggleTheme(): void {
  const root = document.documentElement;
  const current = root.getAttribute('data-theme');
  const resolved = current ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = resolved === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try {
    localStorage.setItem('theme', next);
  } catch {
    /* storage disabled — the toggle still applies for this session */
  }
}
