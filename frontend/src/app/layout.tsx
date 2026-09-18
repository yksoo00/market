import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_KR({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "커널마켓",
  description: "IT 장비 거래 마켓플레이스",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${noto.variable} ${plexMono.variable}`}>
      {/* 홈은 스크롤 없이 한 화면. 하위 페이지는 main 안에서 각자 스크롤 */}
      <body className="h-dvh overflow-hidden flex flex-col">{children}</body>
    </html>
  );
}
