// 비교 문구 — 검색 목록·상세의 [비교에 담기], /my/cart/compare (서버에 저장하는 내 비교 목록, 2026-11-03 부터 쌓인다)
export const compare = {
  button: "비교에 담기",
  tooMany: (n: number) => `한 번에 ${n}개까지 담을 수 있어요.`,
  otherCategory: "같은 카테고리(소분류) 상품끼리만 비교할 수 있어요.",
  // 담기를 눌렀는데 서버가 거절(예: 다른 칸에서 매물이 사라짐)했을 때 알림은 서버 문구를 쓴다
  failed: "비교할 상품을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
  // 담기 성공 안내 (장바구니 담기와 같은 모달)
  added: {
    title: "비교에 담았어요",
    message: "비교 화면에서 나란히 볼 수 있어요.",
    skipped: (n: number) => `이미 담긴 ${n}개는 건너뛰었어요.`,
    view: "비교 보기",
    // 고른 상품이 전부 이미 담겨 있을 때 (담긴 줄을 모르고 다시 눌렀거나 상세의 담김 표시를 못 읽었을 때)
    alreadyTitle: "이미 담겨 있어요",
    alreadyMessage: "비교 화면에서 볼 수 있어요.",
  },
  // 4개가 찼거나 소분류가 달라 담을 수 없을 때 (검색·상세 공용)
  conflict: {
    title: "비교에 담을 수 없어요",
    full: "비교는 4개까지 담을 수 있어요. 비교 목록을 비우고 새로 담을까요?",
    category: "같은 카테고리(소분류) 상품끼리만 비교할 수 있어요. 비교 목록을 비우고 새로 담을까요?",
    view: "비교 보기",
    replace: "비우고 새로 담기",
    cancel: "취소",
  },
  // 상세 화면 버튼
  detail: {
    remove: "비교에서 빼기",
  },
  page: {
    title: "상품 비교",
    count: (n: number) => `비교 상품 ${n}개`,
    onlyDiff: "다른 항목만 보기",
    noDiff: "모든 항목이 같아요.",
    item: "항목",
    empty: "비교할 상품을 추가해주세요.",
    tooFew: "2개 이상이어야 비교할 수 있어요. 상품을 더 담아 주세요.",
    clear: "비교 비우기",
    clearFailed: "비울 수 없어요",
    removedSkipped: "지워진 상품은 빼고 보여 줘요.",
    loadFailed: "비교할 상품을 불러오지 못했어요.",
    retry: "다시 시도",
    toSearch: "상품 검색",
    remove: "빼기",
    removeAria: (name: string) => `${name} 비교에서 빼기`,
    detailAria: (name: string) => `${name} 상세 보기`,
  },
  rows: {
    specInfo: "사양",
    replaceProd: "대체품",
    photoCount: "사진",
    description: "제품 개요",
    tradeStatus: "거래상태",
    has: "있음",
    none: "없음",
    photos: (n: number) => `${n}장`,
    available: "거래 중",
    completed: "거래완료",
  },
  best: {
    unitPrice: "최저가",
    stock: "재고 최대",
    leadTime: "가장 빠름",
    warranty: "가장 김",
    minOrder: "최소",
  },
};
