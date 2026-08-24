import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance OS",
  description: "A personal financial optimisation platform — see what your money should do next.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
