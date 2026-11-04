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
    firstPage: "1페이지로",
    emptyTitle: "아직 확정된 거래가 없어요",
    emptyDesc: "구매가 확정되면 여기에서 볼 수 있어요.",
    // 검색 + 상세 필터 (계획 2026-10-30)
    filter: {
      label: "거래이력 검색",
      // 매물 검색창과 같은 범위·문구 (2026-10-30)
      searchPlaceholder: "모델명·상품번호·제조사",
      search: "검색",
      chips: "필터",
      clear: (what: string) => `${what} 조건 지우기`,
      period: "기간 (확정일)",
      from: "시작일",
      to: "종료일",
      amount: "금액",
      minAmount: "최소 금액",
      maxAmount: "최대 금액",
      won: "원",
      sort: "정렬",
      sorts: { latest: "최신순", amountDesc: "금액높은순", amountAsc: "금액낮은순" },
      // 열 머리를 눌러 정한 정렬의 칩 글자 ("상대 ▲", 2026-11-03)
      sortColumns: { date: "확정일시", side: "구분", name: "상품명", party: "상대", unitPrice: "단가", quantity: "수량", amount: "금액" },
      apply: "적용",
      reset: "필터 초기화",
      resultCount: (n: number) => `조건에 맞는 거래 ${n.toLocaleString("ko-KR")}건`,
      emptyTitle: "조건에 맞는 거래가 없어요",
      emptyDesc: "검색어나 필터를 바꾸거나 초기화해 보세요.",
      validation: {
        q: "검색어는 100자 이하로 입력하세요.",
        date: "날짜를 yyyy-MM-dd 형식의 실제 날짜로 입력하세요.",
        dateOrder: "종료일은 시작일 이후여야 해요.",
        amount: "금액은 0원 이상 2,147,483,647원 이하의 숫자로 입력하세요.",
        amountOrder: "최대 금액은 최소 금액 이상이어야 해요.",
      },
    },
  },
  // 내 활동내역 판매 탭 — 검색 결과 화면과 같은 모양으로 내 글만
  mine: {
    title: "내 판매글",
    subtitle: "내가 등록한 판매글을 검색하고 고쳐요",
    emptyTitle: "등록한 판매글이 없어요",
    emptyAction: "판매상품 등록하기",
  },
  // 내 활동내역 구매 탭 — 내가 구매자인 진행 중 거래 (TradeList role=buyer)
  purchases: {
    emptyTitle: "아직 구매요청이 없어요",
    emptyDesc: "매물을 검색해 [구매]로 요청하면 여기에서 볼 수 있어요.",
    toSearch: "매물 검색하기",
  },
  // 내 활동내역 요청·구매 탭 검색 + 상세 필터 (계획 2026-10-30 후속). 기간·금액·정렬 문구는 history.filter 와 같다
  activityFilter: {
    // 열 머리를 눌러 정한 정렬의 칩 글자 ("상대 ▲", 2026-11-03)
    sortColumns: { name: "상품명", party: "상대", quantity: "수량", unitPrice: "단가", amount: "금액", reqDeli: "납품희망일", status: "상태" },
    label: "거래 검색",
    status: "거래상태",
    statusAll: "전체",
    period: "기간 (요청일)",
    emptyTitle: "조건에 맞는 거래가 없어요",
    emptyDesc: "검색어나 필터를 바꾸거나 초기화해 보세요.",
  },
  // 내 활동내역 요청 탭 — 내 매물에 들어온 진행 중 거래 (TradeList role=seller)
  sales: {
    emptyTitle: "받은 구매요청이 없어요",
    emptyDesc: "구매자가 내 매물에 구매요청을 보내면 여기에서 볼 수 있어요.",
    filtered: "이 매물에 들어온 요청만 보고 있어요",
    showAll: "전체 보기",
  },
};
