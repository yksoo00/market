import Image from "next/image";
import type { ReactNode } from "react";

// 홈 판매·구매 아이콘. 사용자가 준 이미지(글자 뺀 일러스트)를 잘라 public/icons/quick 에 둔 PNG (배경 투명).
// 판매는 보라, 구매는 초록 한 톤이라 배지·호버 색(QuickMenu toneClass)과 맞는다.
const pictures = ["sellNew", "sellBulk", "sellExtra", "sellQuote", "buyRequest", "buyQuotes"] as const;

// 이미지에 없는 아이콘만 인라인 SVG. 연한 면 + 진한 선 2톤 (design.md "홈 판매·구매 아이콘")
// TODO(이미지 없음): 엑셀 대량구매는 사용자 이미지에 없어 옛 SVG 그대로. 이미지가 오면 pictures 로 옮기고 이 블록 제거
const s = "fill-(--quick-soft)";
const b = "fill-current stroke-none";
const art = {
  // 엑셀 대량구매: 카트 안에 표
  buyBulk: (
    <>
      <path className={s} d="M11 13h32l-4.5 17H14z" />
      <path d="M3 7h5l6 23h24.5M20 13v17M28 13v17M36 13v17M12.5 21.5h28.5" />
      <circle className={b} cx="17" cy="38" r="3" />
      <circle className={b} cx="34" cy="38" r="3" />
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
