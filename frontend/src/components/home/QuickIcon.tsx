import Image from "next/image";
import type { ReactNode } from "react";

// 홈 판매·구매 아이콘. 사용자가 준 이미지(글자 뺀 일러스트)를 잘라 public/icons/quick 에 둔 PNG (배경 투명).
// 판매는 보라, 구매는 초록 한 톤이라 배지·호버 색(QuickMenu toneClass)과 맞는다.
const pictures = ["sellNew", "sellBulk", "sellExtra", "sellQuote", "buyRequest", "buyQuotes"] as const;

// 이미지에 없는 아이콘만 인라인 SVG. 연한 면 + 진한 선 2톤 (design.md "홈 판매·구매 아이콘")
// 엑셀 대량구매는 사용자 이미지에 없어 이미지 톤에 맞춰 직접 그림. 이미지가 오면 pictures 로 옮기고 이 블록 제거
const s = "fill-(--quick-soft)";
const w = "fill-surface";
const b = "fill-current stroke-none";
const bw = "stroke-surface";
const art = {
  // 엑셀 대량구매: 겹친 문서 + 엑셀 표지(X) + 장바구니 배지. 글자 없이도 "엑셀로 한꺼번에 구매"로 읽히게
  buyBulk: (
    <>
      <path className={s} d="M17 5h14l7 7v21a2 2 0 0 1-2 2H17a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
      <path className={s} d="M11 11h14l7 7v21a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V13a2 2 0 0 1 2-2z" />
      <path className={w} d="M25 11v7h7" />
      <path d="M17 25h9M17 31h9" />
      <rect className={b} x="3" y="19" width="14" height="14" rx="2" />
      <path className={bw} d="M7 23l6 6M13 23l-6 6" />
      <circle className={b} cx="37" cy="37" r="9" />
      <path className={bw} strokeWidth="1.8" d="M31 32h2.4l1.6 7h6l1.6-5H33.6" />
      <circle className="fill-surface stroke-none" cx="35.4" cy="41.8" r="1.3" />
      <circle className="fill-surface stroke-none" cx="40.2" cy="41.8" r="1.3" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type QuickIconName = (typeof pictures)[number] | keyof typeof art;

const size = "size-10 @md:size-12";

function isPicture(name: QuickIconName): name is (typeof pictures)[number] {
  return (pictures as readonly string[]).includes(name);
}

export function QuickIcon({ name }: { name: QuickIconName }) {
  if (isPicture(name)) {
    // 장식 — 이름은 감싼 링크·버튼의 aria-label 이 읽는다
    return <Image src={`/icons/quick/${name}.png`} alt="" width={160} height={160} className={size} />;
  }
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={size}
    >
      {art[name]}
    </svg>
  );
}
