// 장바구니 문구 — 헤더 아이콘, 검색 결과·상세의 [장바구니], /my/cart (스펙 2026-10-21)
export const cart = {
  header: {
    label: "장바구니",
    aria: (n: number) => (n > 0 ? `장바구니 ${n}개` : "장바구니"),
  },
  add: {
    button: "장바구니",
    tooMany: (n: number) => `한 번에 ${n}개까지 담을 수 있어요.`,
    doneTitle: "장바구니에 담았어요",
    doneMessage: "장바구니에서 골라 견적 요청하거나 구매할 수 있어요.",
    toCart: "장바구니 보기",
  },
  page: {
    title: "장바구니",
    empty: "장바구니가 비었어요.",
    toSearch: "상품 검색",
    remove: "빼기",
    completedSkipped: "거래가 끝난 상품은 빼고 골랐어요.",
    loadFailed: "장바구니를 불러오지 못했어요.",
    retry: "다시 시도",
  },
};
