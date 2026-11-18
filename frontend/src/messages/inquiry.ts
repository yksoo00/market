// 문의 게시판 문구 (스펙 2026-11-18-inquiry-board-design.md). 사내 테스트용 — 운영 공개 전 제거
export const inquiry = {
  page: {
    title: "문의 게시판",
    subtitle: "로그인 없이 익명으로 남길 수 있어요. 작성자는 저장되지 않습니다.",
  },
  list: {
    loading: "불러오는 중…",
    empty: "아직 문의가 없습니다. 첫 문의를 남겨 보세요.",
    loadFailed: "문의 목록을 불러올 수 없습니다.",
    more: "더 보기",
    moreLoading: "불러오는 중…",
    replyCount: (n: number) => `답글 ${n}`,
  },
  form: {
    heading: "문의 남기기",
    title: "제목",
    titlePlaceholder: "제목을 입력하세요",
    content: "내용",
    contentPlaceholder: "문의 내용을 입력하세요",
    submit: "등록",
    failed: "문의를 등록할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    counter: (n: number, max: number) => `${n} / ${max}`,
  },
  detail: {
    loading: "불러오는 중…",
    notFound: "문의를 찾을 수 없습니다.",
    loadFailed: "문의를 불러올 수 없습니다.",
    back: "목록으로",
    repliesHeading: (n: number) => `답글 ${n}개`,
    noReplies: "아직 답글이 없습니다.",
  },
  reply: {
    content: "답글",
    placeholder: "답글을 입력하세요",
    submit: "답글 등록",
    failed: "답글을 등록할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  },
  validation: {
    titleRequired: "제목을 입력하세요",
    titleMax: "제목은 100자 이하로 입력하세요",
    contentRequired: "내용을 입력하세요",
    contentMax: "내용은 2000자 이하로 입력하세요",
    replyRequired: "답글을 입력하세요",
    replyMax: "답글은 1000자 이하로 입력하세요",
  },
} as const;
