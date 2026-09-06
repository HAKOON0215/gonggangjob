import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "공강잡 - 공강이 돈이 되는 시간",
  description: "시간표를 올리면 공강에 맞는 캠퍼스 근처 당일 알바를 추천해드려요.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
