import type { ReactNode } from "react";

// 로그인·가입 화면의 한 칸(가운데 카드). 홈 | 로그인, 로그인 | 가입 같은 분할은 화면이 아니라 타일 큐가 만든다
// (decisions.md 2026-10-01 타일 큐).
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex-1 min-h-0 overflow-y-auto">
      {/* 칸 가운데 정렬은 items-center 대신 자식의 my-auto로 한다. items-center는 내용이 칸보다 길면
          위쪽까지 넘쳐 스크롤로도 닿지 않지만, auto margin은 넘칠 때 0이 되어 위에서부터 스크롤된다 */}
      {/* 안쪽 래퍼도 flex justify-center: AuthCard는 max-w-[420px]라 560 래퍼 안에서 왼쪽에 붙지 않게 */}
      <section className="min-h-full px-4 py-6 @md:px-6 @md:py-8 flex justify-center">
        <div className="w-full max-w-[560px] my-auto flex justify-center">{children}</div>
      </section>
    </main>
  );
}
