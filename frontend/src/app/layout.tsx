import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans_KR } from "next/font/google";
import { Header } from "@/components/common/Header";
import { TileWorkspace } from "@/components/common/TileWorkspace";
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

const FRAMED_FLAG_SCRIPT = 'if (window.self !== window.top) document.documentElement.dataset.framed = "";';

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: 아래 스크립트가 하이드레이션 전에 html에 data-framed를 붙이므로
    <html lang="ko" className={`${noto.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        {/* 타일 큐의 서브 칸(iframe)이면 그려지기 전에 표시해, 헤더처럼 칸 안에서 숨길 것을 CSS로 바로 숨긴다.
            useIsFramed는 하이드레이션 뒤에야 알 수 있어 그 사이 헤더가 잠깐 보였다 사라졌다. 고정 문자열이라 안전 */}
        <script dangerouslySetInnerHTML={{ __html: FRAMED_FLAG_SCRIPT }} />
      </head>
      {/* 홈은 스크롤 없이 한 화면. 하위 페이지는 main 안에서 각자 스크롤 */}
      <body className="h-dvh overflow-hidden flex flex-col">
        {/* 헤더는 분할 바깥(칸 그리드 위)에 둔다. 타일이 열려도 전체 폭 한 줄로 고정되고, 아래 영역만 나뉜다 */}
        <TileWorkspace header={<Header />}>{children}</TileWorkspace>
      </body>
    </html>
  );
}
