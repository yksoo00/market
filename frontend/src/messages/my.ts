export const my = {
  // 헤더 사용자 메뉴 (아이콘을 누르면 열림)
  menu: {
    label: "내 메뉴",
    myPage: "마이페이지",
    myActivity: "내 활동내역",
    myHistory: "내 거래이력",
    logout: "로그아웃",
    loggingOut: "로그아웃 중…",
    logoutFailed: "로그아웃에 실패했어요. 다시 시도해 주세요.",
    personal: "개인",
    business: "사업자",
  },
  // /my 허브
  page: {
    title: "마이페이지",
    subtitle: "내 활동내역과 거래이력으로 이동해요",
  },
  hub: {
    activityDesc: "받은 요청·내 판매글·내가 보낸 견적과 구매요청",
    historyDesc: "구매가 확정된 거래 기록",
  },
  // /my/activity — 탭 3개 (요청·판매·구매)
  activity: {
    title: "내 활동내역",
    tabsLabel: "활동 종류",
    tabs: { requests: "요청", sales: "판매", purchases: "구매" },
  },
  // /my/history — 구매확정된 거래 (trd_trade_history)
  history: {
    title: "내 거래이력",
    tabsLabel: "거래 구분",
    tabs: { all: "전체", buy: "구매", sell: "판매" },
    sides: { buy: "구매", sell: "판매" },
    columns: { date: "확정일시", side: "구분", product: "상품명", counterpart: "상대", unitPrice: "단가", quantity: "수량", amount: "금액" },
    loading: "불러오는 중…",
    loadFailed: "거래이력을 불러오지 못했어요.",
    retry: "다시 시도",
    more: "더 보기",
    emptyTitle: "아직 확정된 거래가 없어요",
    emptyDesc: "구매가 확정되면 여기에서 볼 수 있어요.",
  },
  // 내 활동내역 판매 탭 — 검색 결과 화면과 같은 모양으로 내 글만
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
  // 내 활동내역 구매 탭 — 내가 구매자인 진행 중 거래 (TradeList role=buyer)
  purchases: {
    emptyTitle: "아직 구매요청이 없어요",
    emptyDesc: "매물을 검색해 [구매]로 요청하면 여기에서 볼 수 있어요.",
    toSearch: "매물 검색하기",
  },
  // 내 활동내역 요청 탭 — 내 매물에 들어온 진행 중 거래 (TradeList role=seller)
  sales: {
    emptyTitle: "받은 구매요청이 없어요",
    emptyDesc: "구매자가 내 매물에 구매요청을 보내면 여기에서 볼 수 있어요.",
    filtered: "이 매물에 들어온 요청만 보고 있어요",
    showAll: "전체 보기",
  },
};
