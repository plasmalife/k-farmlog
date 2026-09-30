import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "K영농일지 · 오늘의 농사를 기록하세요",
  description:
    "사진과 목소리로 남기는 나의 영농일지. 오늘의 수고를 차곡차곡 기록합니다.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#00875b",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
