import type { Metadata } from "next";
import BgmToggle from "@/components/BgmToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "던전 TRPG",
  description: "AI 나레이터와 함께하는 텍스트 기반 던전 탐험 TRPG",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">
        <div className="bgm-layer">
          <BgmToggle />
        </div>
        {children}
      </body>
    </html>
  );
}
