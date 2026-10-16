// 구매(거래) 화면 문구 — 구매 모달, 내 구매목록, 받은 구매요청
export const trade = {
  // 백엔드 ErrorCode 이름과 같은 키 (backend.md "오류 코드 이름 = 프론트 errors 키")
  errors: {
    TRADE_NOT_FOUND: "거래를 찾을 수 없어요. 목록을 새로 불러와 주세요.",
    TRADE_OWN_LISTING: "내 매물은 구매할 수 없어요.",
    TRADE_OUT_OF_STOCK: "재고가 부족해요. 남은 재고를 확인하고 주문량을 줄여 주세요.",
    TRADE_NOT_PENDING: "이미 확정되었거나 취소된 거래예요. 목록을 새로 불러왔어요.",
    TRADE_ID_EXHAUSTED: "주문이 몰려 있어요. 잠시 후 다시 시도해 주세요.",
    LISTING_COMPLETED: "거래가 끝난 매물이에요.",
    LISTING_NOT_FOUND: "매물을 찾을 수 없어요.",
    FORBIDDEN: "이 거래를 처리할 권한이 없어요.",
    RATE_LIMITED: "구매요청이 너무 많아요. 잠시 후 다시 시도해 주세요.",
    // 응답이 유실돼 다시 누른 요청이 첫 요청과 겹칠 때 (Idempotency-Key)
    REQUEST_IN_PROGRESS: "앞서 누른 구매요청을 처리하고 있어요. 잠시 후 다시 시도해 주세요.",
    UNAUTHENTICATED: "로그인이 만료됐어요. 다시 로그인해 주세요.",
    UNAUTHORIZED: "로그인이 만료됐어요. 다시 로그인해 주세요.",
  } as Record<string, string>,
  // 수치는 서버 TradeService·TradeCreateRequest 와 같다 (docs/security.md "입력 검증 > 구매")
  validation: {
    required: "주문량을 입력해 주세요.",
    quantityFormat: "주문량은 숫자로만 입력해 주세요.",
    quantityMin: (n: number) => `최소주문량(${n.toLocaleString("ko-KR")}개) 이상 주문해 주세요.`,
    quantityUnit: (n: number) => `주문단위(${n.toLocaleString("ko-KR")}개)의 배수로 주문해 주세요.`,
    quantityStock: (n: number) => `현재 재고(${n.toLocaleString("ko-KR")}개)보다 많이 주문할 수 없어요.`,
    amountMax: "한 번에 주문할 수 있는 금액을 넘었어요. 주문량을 줄여 주세요.",
    deliRequired: "이 매물은 납기일이 없어요. 납품희망일을 입력해 주세요.",
    date: "있는 날짜를 YYYY-MM-DD 형식으로 입력해 주세요.",
    deliPast: "납품희망일은 오늘 이후 날짜로 입력해 주세요.",
    remarksMax: "요청사항은 100자까지 쓸 수 있어요.",
  },
  // 구매 모달 (상세·검색 결과의 [구매])
  purchase: {
    title: "구매요청",
    desc: "단가는 판매자가 등록한 값 그대로예요. 보내면 바로 재고가 줄어요.",
    loading: "매물 정보를 불러오는 중…",
    loadFailed: "매물 정보를 불러오지 못했어요.",
    retry: "다시 시도",
    unitPrice: "단가",
    stock: "현재 재고",
    minOrder: "최소주문량",
    unit: "주문단위",
    provDate: "납기일",
    none: "없음",
    count: (n: number) => `${n.toLocaleString("ko-KR")}개`,
    orderQuantity: "주문량",
    reqDeliDate: "납품희망일",
    reqDeliDateHint: " (비우면 납기일)",
    remarks: "요청사항",
    remarksPlaceholder: "판매자에게 전할 말 (선택, 100자)",
    amount: "금액",
    submit: "구매요청",
    cancel: "닫기",
    stockRefreshed: "재고가 바뀌어 다시 불러왔어요. 주문량을 확인해 주세요.",
    doneTitle: "구매요청을 보냈어요",
    doneMessage: "물건을 받으면 내 구매목록에서 [거래완료]를 눌러 주세요.\n확정 전에는 구매자·판매자 누구나 취소할 수 있어요.",
    toPurchases: "내 구매목록",
    // [구매]를 못 누르는 이유 (lib/listingDetail purchaseBlockReason)
    blocked: {
      completed: "거래가 끝난 매물이에요.",
      own: "내 매물은 구매할 수 없어요.",
      lowStock: "재고가 최소주문량보다 적어 구매할 수 없어요.",
    },
    // 검색 결과에서 여러 개를 체크하고 [구매]를 누를 때
    oneAtATime: "구매는 한 번에 한 매물씩 요청할 수 있어요. 하나만 체크해 주세요.",
  },
};
