import type { ReactNode } from "react";

// 홈 판매·구매 아이콘. 선 아이콘(Icon.tsx)과 달리 연한 면 + 진한 선 + 꽉 찬 배지의 2톤 일러스트
// (design.md "홈 판매·구매 아이콘"). 사용자가 준 일러스트(글자 뺀 것)를 본떠 직접 그렸다.
// 색은 감싼 요소의 text-* (선·배지)와 tone 의 연한 면 색을 쓴다.
// 클래스 묶음: s = 연한 면, w = 흰 면, b = 배지 원(꽉 찬 색), bw = 배지 위 흰 선
const s = "fill-(--quick-soft)";
const w = "fill-surface";
const b = "fill-current stroke-none";
const bw = "stroke-surface";

// 톱니바퀴: 바깥으로 뻗은 이빨 8개 + 연한 면 몸통 + 가운데 구멍
function Gear({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const teeth = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const [dx, dy] = [Math.cos(a), Math.sin(a)];
    return `M${(cx + dx * r).toFixed(1)} ${(cy + dy * r).toFixed(1)}L${(cx + dx * (r + 2)).toFixed(1)} ${(cy + dy * (r + 2)).toFixed(1)}`;
  }).join("");
  return (
    <>
      <path strokeWidth="2.4" d={teeth} />
      <circle className={s} cx={cx} cy={cy} r={r} strokeWidth="1.6" />
      <circle cx={cx} cy={cy} r={r / 2.5} strokeWidth="1.4" />
    </>
  );
}

const art = {
  // 판매상품 등록: 열린 상자 + 상자에 물건을 넣는 손 + 플러스 배지
  sellNew: (
    <>
      <path className={s} d="M7 25h32v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
      <path className={s} d="M7 25l-4-8h13l2 8zM39 25l4-8H30l-2 8z" />
      <path className={w} d="M17 19l6-3 6 3v6l-6 3-6-3zM17 19l6 3 6-3M23 22v6" />
      <path d="M20 10c1-3 6-3 7 0M27 10l7-5" />
      <circle className={b} cx="37" cy="37" r="9" />
      <path className={bw} d="M37 33v8M33 37h8" />
    </>
  ),
  // 판매상품 다량 등록: 겹친 문서 + 엑셀 표지 + 올리기 배지
  sellBulk: (
    <>
      <path className={s} d="M17 5h14l7 7v21a2 2 0 0 1-2 2H17a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
      <path className={s} d="M11 11h14l7 7v21a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V13a2 2 0 0 1 2-2z" />
      <path className={w} d="M25 11v7h7" />
      <path d="M17 25h9M17 31h9" />
      <rect className={b} x="3" y="19" width="14" height="14" rx="2" />
      <path className={bw} d="M7 23l6 6M13 23l-6 6" />
      <circle className={b} cx="37" cy="37" r="9" />
      <path className={bw} d="M37 41v-8M33.5 36.5L37 33l3.5 3.5" />
    </>
  ),
  // 판매정보 추가 등록: 문서 + 연필 + 톱니바퀴
  sellExtra: (
    <>
      <path className={s} d="M9 5h15l8 8v26a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
      <path className={w} d="M24 5v8h8" />
      <path d="M12 19h12M12 25h9M12 33h5" />
      <path className={w} d="M31 20l5 5-12 12-6 1 1-6z" />
      <path d="M28 23l5 5" />
      <Gear cx={41} cy={11} r={2.8} />
      <Gear cx={39} cy={37} r={4.6} />
    </>
  ),
  // 판매 견적 조정: 문서 + $ + 오르내림 화살표 + 조정 막대
  sellQuote: (
    <>
      <path className={s} d="M12 5h15l8 8v27a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
      <path className={w} d="M27 5v8h8" />
      <path d="M27 21c-1-3-8-3-8 0.5s8 2 8 6-7 3.5-8 0.5M23 17.5V21M23 27v3.5" />
      <path d="M14 37h14M5 25V12M2.5 14.5L5 12l2.5 2.5M43 12v13M40.5 22.5L43 25l2.5-2.5" />
      <circle className={b} cx="28" cy="37" r="2.2" />
    </>
  ),
  // 상품검색·견적 요청: 상자 + 돋보기 + 물음표 말풍선
  buyRequest: (
    <>
      <path className={s} d="M3 17l4-6h17l4 6v18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 17h25M15.5 11v6" />
      <circle className={w} cx="36" cy="13" r="8" />
      <path d="M33.5 11a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M36 18v.2M30 18.5l-3 3" />
      <circle className={w} cx="21" cy="31" r="7.5" />
      <path strokeWidth="3.5" d="M26.5 36.5l8 8" />
    </>
  ),
  // 견적 확인: 클립보드 체크리스트 + 체크 배지
  buyQuotes: (
    <>
      <rect className={s} x="7" y="8" width="28" height="34" rx="3" />
      <rect className={w} x="14" y="5" width="14" height="6" rx="2" />
      <path d="M12 19l1.6 1.6 3-3.2M20 19h10M12 26l1.6 1.6 3-3.2M20 26h10M12 33l1.6 1.6 3-3.2M20 33h6" />
      <circle className={b} cx="37" cy="37" r="9" />
      <path className={bw} d="M33 37.5l2.8 2.8 5-5.3" />
    </>
  ),
  // 엑셀 대량구매: 카트 안에 표 (이미지에 없어 이전 그림 그대로)
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
