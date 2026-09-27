import type { Metadata } from "next";
import "./globals.css";
import "./social-auth.css";
import "./exploration.css";
import "./experience-updates.css";

export const metadata: Metadata = {
  title: "기웃 · 길냥이들의 숨은 골목 지도",
  description: "골목대장 고양이 기웃이와 함께 뻔한 핫플 밖, 진짜 로컬 스팟을 발견하고 AR 흔적을 남겨보세요.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "기웃",
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
