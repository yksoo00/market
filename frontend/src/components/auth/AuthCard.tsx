import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  /** 기업 가입 폼처럼 넓은 카드 */
  wide?: boolean;
  children: ReactNode;
}

/** 로그인·가입 페이지 공용 카드. 규격은 design.md "폼 페이지" */
export function AuthCard({ title, subtitle, wide = false, children }: Props) {
  return (
    <div className={`w-full ${wide ? "max-w-[560px]" : "max-w-[420px]"} flex flex-col gap-4`}>
      <div className="flex flex-col gap-1 px-1">
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="text-[13px] text-ink-2">{subtitle}</p>}
      </div>
      {/* @container: 가입 폼의 라벨-옆 격자(FormField inline="narrow")가 카드 안쪽 폭을 기준으로 반응하게 */}
      <div className="@container bg-surface border border-line rounded-md p-5 @md:p-6">{children}</div>
    </div>
  );
}
