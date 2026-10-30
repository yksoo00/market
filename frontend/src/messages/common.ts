export const common = {
  unreachable: "서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  serverError: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  retry: "다시 시도",
  submitting: "처리 중…",
  tileClose: "닫기",
  tileFrameTitle: "보조 화면",
  // 페이지 번호 줄 (설계 2026-10-27 PR 5)
  pager: {
    label: "페이지",
    prev: "이전 페이지",
    next: "다음 페이지",
    go: (page: number) => `${page}페이지`,
    total: (n: number) => `전체 ${n.toLocaleString("ko-KR")}건`,
  },
};
