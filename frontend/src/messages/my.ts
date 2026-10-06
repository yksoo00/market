export const my = {
  // 헤더 사용자 메뉴 (아이콘을 누르면 열림)
  menu: {
    label: "내 메뉴",
    myPage: "마이페이지",
    logout: "로그아웃",
    loggingOut: "로그아웃 중…",
    logoutFailed: "로그아웃에 실패했어요. 다시 시도해 주세요.",
    personal: "개인",
    business: "사업자",
  },
  // /my
  page: {
    title: "마이페이지",
    subtitle: "내가 등록한 판매글을 모아 봐요",
  },
  listings: {
    title: "내 판매글",
    emptyTitle: "등록한 판매글이 없어요",
    emptyAction: "판매상품 등록하기",
    loadMore: "더 보기",
    moreFailed: "더 불러오지 못했어요. 다시 시도해 주세요.",
    status: { available: "판매중", completed: "거래완료" },
    actions: { detail: "상세", edit: "수정", extra: "판매정보 추가" },
    noPhoto: "사진 없음",
    quantity: (n: number) => `수량 ${n}`,
  },
};
