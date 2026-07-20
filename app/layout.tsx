import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

const TITLE = "Історія в картках — українська хронологічна гра";
const DESCRIPTION =
  "Розстав картки з подіями, персонами та місцями України в правильному хронологічному порядку. Безкоштовна браузерна гра на основі Вікіпедії.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Історія в картках",
    locale: "uk_UA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  other: {
    // сайт має власну темну тему — просимо розширення Dark Reader не чіпати
    // сторінку (воно інжектить атрибути в SVG і ламає гідратацію React)
    "darkreader-lock": "true",
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uk"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-inter)]">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
