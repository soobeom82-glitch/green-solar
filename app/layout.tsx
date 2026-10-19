import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solar View | 태양광 통합 관제",
  description: "실시간 발전량과 발전 추이를 한눈에 확인하는 태양광 통합 대시보드",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
