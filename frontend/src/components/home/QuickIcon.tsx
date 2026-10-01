import type { ReactNode } from "react";

// 홈 판매·구매 아이콘. 선 아이콘(Icon.tsx)과 달리 연한 면 + 진한 선 + 꽉 찬 배지의 2톤 일러스트
// (design.md "홈 판매·구매 아이콘"). 색은 감싼 요소의 text-* (선·배지)와 tone 의 연한 면 색을 쓴다.
// 클래스 묶음: s = 연한 면, w = 흰 면, b = 배지 원(꽉 찬 색), bw = 배지 위 흰 선
const s = "fill-(--quick-soft)";
const w = "fill-surface";
const b = "fill-current stroke-none";
const bw = "stroke-surface";

const art = {
  // 판매상품 등록: 상자 + 플러스 배지
  sellNew: (
    <>
      <path className={s} d="M6 17l4-7h20l4 7v20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
      <path d="M6 17h28M20 10v7M15 25h10" />
      <circle className={b} cx="36" cy="35" r="9" />
      <path className={bw} d="M36 31v8M32 35h8" />
    </>
  ),
  // 판매상품 다량 등록: 겹친 상자 + 올리기 배지
  sellBulk: (
    <>
      <rect className={s} x="15" y="6" width="24" height="17" rx="2" />
      <rect className={s} x="7" y="15" width="24" height="22" rx="2" />
      <path d="M7 22h24M16 15v7" />
      <circle className={b} cx="36" cy="35" r="9" />
      <path className={bw} d="M36 39v-8M32.5 34.5L36 31l3.5 3.5" />
    </>
  ),
  // 판매정보 추가 등록: 문서 + 연필 배지
  sellExtra: (
    <>
      <path className={s} d="M11 5h15l9 9v25a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
      <path className={w} d="M26 5v9h9" />
      <path d="M14 21h14M14 27h9" />
      <circle className={b} cx="36" cy="35" r="9" />
      <path className={bw} d="M32 39l.8-3 4.7-4.7 2.2 2.2-4.7 4.7z" />
    </>
  ),
  // 판매 견적 조정: 가격표 + 오르내림 배지
  sellQuote: (
    <>
      <path className={s} d="M5 8v12l17 17a2 2 0 0 0 2.8 0l11-11a2 2 0 0 0 0-2.8L19 6H7a2 2 0 0 0-2 2z" />
      <circle className={w} cx="12" cy="13" r="2.5" />
      <circle className={b} cx="36" cy="35" r="9" />
      <path className={bw} d="M33.5 39.5v-8M31.5 33.5l2-2 2 2M38.5 31.5v8M36.5 37.5l2 2 2-2" />
    </>
  ),
  // 상품검색·견적 요청: 상자 + 돋보기
  buyRequest: (
    <>
      <path className={s} d="M5 15l4-6h18l4 6v19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
      <path d="M5 15h26M18 9v6" />
      <circle className={w} cx="31" cy="29" r="8" />
      <path strokeWidth="3.5" d="M37 35l6 6" />
    </>
  ),
  // 견적 확인: 클립보드 + 체크 배지
  buyQuotes: (
    <>
      <rect className={s} x="8" y="8" width="26" height="33" rx="3" />
      <rect className={w} x="15" y="5" width="12" height="6" rx="2" />
      <path d="M14 20h14M14 26h9" />
      <circle className={b} cx="36" cy="35" r="9" />
      <path className={bw} d="M32 35.5l2.8 2.8 5-5.3" />
    </>
  ),
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

export type QuickIconName = keyof typeof art;

export function QuickIcon({ name }: { name: QuickIconName }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-10 @md:size-12"
    >
      {art[name]}
    </svg>
  );
}
