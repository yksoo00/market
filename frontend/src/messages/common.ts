export const common = {
  unreachable: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  serverError: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  retry: "다시 시도",
  submitting: "처리 중…",
  tileClose: "닫기",
  tileFrameTitle: "보조 화면",
  // 클릭 뒤 안내 모달 (NoticeDialog). 제목은 안내마다 짧게
  notice: {
    confirm: "확인",
    compareBlocked: "비교할 수 없어요",
    quoteBlocked: "견적을 보낼 수 없어요",
    cartBlocked: "담을 수 없어요",
    buyBlocked: "구매를 시작할 수 없어요",
    someSkipped: "일부 매물은 제외했어요",
    uploadBlocked: "파일을 올릴 수 없어요",
    uploadChecked: "파일을 확인했어요",
    removeFailed: "뺄 수 없어요",
    tradeActionFailed: "처리할 수 없어요",
  },
  // 페이지 번호 줄 (설계 2026-10-27 PR 5)
  pager: {
    label: "페이지",
    prev: "이전 페이지",
    next: "다음 페이지",
    go: (page: number) => `${page}페이지`,
    total: (n: number) => `전체 ${n.toLocaleString("ko-KR")}건`,
  },
};
