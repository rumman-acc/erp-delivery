import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP Delivery App",
  description: "ERP Delivery App — D365 BC Implementation tracker",
};

// Runs before paint so the stored theme applies immediately — the source
// app hardcodes class="dark" and swaps it late (end of its inline script),
// which causes a visible flash for light-theme users. This blocking script
// is a deliberate small improvement, not a parity requirement (plan.md §11).
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('erp-theme');
    document.documentElement.className = stored === 'light' ? 'light' : 'dark';
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
