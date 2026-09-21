import type { ReactNode } from "react";
import { Header } from "@/components/common/Header";

// body 가 h-dvh overflow-hidden 이라(홈 규칙) 하위 페이지는 main 안에서 스크롤
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-6 md:py-10">
        <div className="min-h-full flex flex-col items-center md:justify-center">{children}</div>
      </main>
    </>
  );
}
