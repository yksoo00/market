import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 개발 서버 왼쪽 아래 Next.js 표시(N)를 숨긴다. 타일 칸(iframe)마다 떠서 화면을 가렸다.
  // 컴파일·런타임 오류는 꺼도 그대로 표시된다
  devIndicators: false,
};

export default nextConfig;
