import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance OS",
  description: "A personal financial optimisation platform — see what your money should do next.",
};

// Applies the saved theme choice to <html> before first paint, so a forced light/dark never flashes.
// No stored value (or "system") leaves data-theme unset → the OS preference governs via CSS.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {children}
      </body>
    </html>
  );
}
