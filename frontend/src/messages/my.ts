export const my = {
  // 헤더 사용자 메뉴 (아이콘을 누르면 열림)
  menu: {
    label: "내 메뉴",
    myPage: "마이페이지",
    myListings: "내 판매글",
    myPurchases: "내 구매목록",
    mySales: "받은 구매요청",
    logout: "로그아웃",
    loggingOut: "로그아웃 중…",
    logoutFailed: "로그아웃에 실패했어요. 다시 시도해 주세요.",
    personal: "개인",
    business: "사업자",
  },
  // /my 허브
  page: {
    title: "마이페이지",
    subtitle: "내 판매글·받은 구매요청·구매 내역으로 이동해요",
  },
  hub: {
    listingsDesc: "내가 등록한 판매글을 검색하고 고쳐요",
    salesDesc: "내 매물에 들어온 구매요청을 보고 취소해요",
    purchasesDesc: "내가 요청하고 구매한 내역",
  },
  // /my/listings — 검색 결과 화면과 같은 모양으로 내 글만
  mine: {
    title: "내 판매글",
    subtitle: "내가 등록한 판매글을 검색하고 고쳐요",
    emptyTitle: "등록한 판매글이 없어요",
    emptyAction: "판매상품 등록하기",
    editColumn: "수정",
    edit: "수정",
    editAria: (name: string) => `${name} 수정`,
    // 행 안 수정 (RowEditor)
    row: {
      loading: "수정할 내용을 불러오는 중…",
      loadFailed: "수정할 내용을 불러오지 못했어요.",
      retry: "다시 시도",
      editing: (name: string) => `${name} 수정 중`,
      save: "저장",
      saving: "저장 중…",
      cancel: "취소",
      noChange: "바꾼 내용이 없어요",
      warranty: "보증기간",
      panelHas: "입력됨",
      panelNone: "없음",
    },
  },
  // /my/purchases — 내가 구매자인 거래 (TradeList role=buyer)
  purchases: {
    title: "내 구매목록",
    emptyTitle: "아직 구매요청이 없어요",
    emptyDesc: "매물을 검색해 [구매]로 요청하면 여기에서 볼 수 있어요.",
    toSearch: "매물 검색하기",
  },
  // /my/sales — 내 매물에 들어온 거래 (TradeList role=seller)
  sales: {
    title: "받은 구매요청",
    emptyTitle: "받은 구매요청이 없어요",
    emptyDesc: "구매자가 내 매물에 구매요청을 보내면 여기에서 볼 수 있어요.",
    filtered: "이 매물에 들어온 요청만 보고 있어요",
    showAll: "전체 보기",
  },
};
