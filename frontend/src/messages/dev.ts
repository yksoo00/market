// 로컬 전용 임시 테이블 관리 화면 문구 (계획 2026-10-30-dev-table-admin.md)
export const dev = {
  // 헤더 바로가기 (NEXT_PUBLIC_DEV_TOOLS=true 일 때만)
  headerLink: "임시 테이블",
  page: {
    title: "임시 테이블 관리",
    subtitle: "테스트용입니다. 서비스 검증 없이 DB에 바로 읽고 씁니다. 로컬(APP_ENV=local)에서만 동작합니다.",
  },
  loadFailed: "테이블 목록을 불러오지 못했습니다.",
  loading: "불러오는 중…",
  query: "조회하기",
  create: "생성하기",
  update: "수정하기",
  remove: "삭제하기",
  importTable: "이 테이블 엑셀 불러오기",
  importAll: "엑셀 전체 불러오기",
  empty: "조회된 행이 없습니다.",
  pkMark: "PK",
  prevPage: "이전",
  nextPage: "다음",
  pageRange: (from: number, to: number, total: number) => `${from.toLocaleString("ko-KR")}–${to.toLocaleString("ko-KR")} / ${total.toLocaleString("ko-KR")}행`,
  notQueried: "[조회하기]를 누르면 행이 나옵니다.",
  form: {
    createTitle: (table: string) => `${table} 행 생성`,
    updateTitle: (table: string) => `${table} 행 수정`,
    pkReadonly: "PK (수정 불가)",
    required: "필수",
    submit: "저장",
    cancel: "취소",
    saving: "저장 중…",
    hint: "빈 칸은 null 로 저장됩니다. 새로 만들 때 서버가 채우는 칸(uid·prod_id·trade_id·ser_no·등록일시)은 칸이 없고, 엑셀에 있어도 무시하고 서버가 규칙대로 새로 만듭니다. 엑셀 여러 시트를 한 번에 넣으면 그 키를 가리키는 칸은 새 키에 맞춰 바뀌고, 옛 키 → 새 키 목록이 결과에 나옵니다. 비밀번호(password)는 평문을 넣으면 bcrypt 로 바꿔 저장하고, 이미 bcrypt 해시면 그대로 저장합니다. 수정에서 *** 는 안 바꾼 것으로 봅니다.",
  },
  confirmDelete: {
    title: "행을 삭제할까요?",
    // 외래키가 없어 남는 자식 행(딸린 매물·거래·거래이력 등)도 같이 지운다 (사용자 지시 2026-11-03)
    message: (key: string, related: Record<string, number>) => {
      const lines = Object.entries(related).map(([table, n]) => `  · ${table}: ${n.toLocaleString("ko-KR")}행`);
      return [
        key,
        lines.length > 0 ? `딸린 다른 테이블의 행도 같이 지워져요:\n${lines.join("\n")}` : "딸린 다른 테이블의 행은 없어요.",
        "서비스 규칙 없이 바로 지워지고 되돌릴 수 없습니다.",
      ].join("\n");
    },
    confirm: "삭제",
    cancel: "취소",
  },
  result: {
    queryFailed: "조회하지 못했어요",
    saved: "저장했어요",
    deleted: "삭제했어요",
    deletedLine: (table: string, n: number) => `${table}: ${n.toLocaleString("ko-KR")}행`,
    relatedFailed: "딸린 행을 확인하지 못했어요",
    deleteFailed: "삭제하지 못했어요",
    importDone: "불러오기를 마쳤어요",
    importFailed: "불러오지 못했어요",
    importLine: (table: string, inserted: number, keys: string[] = []) =>
      [`${table}: ${inserted.toLocaleString("ko-KR")}행`, ...keys.slice(0, 20).map((k) => `  · ${k}`), ...(keys.length > 20 ? [`  · 외 ${keys.length - 20}건`] : [])].join("\n"),
    xlsxOnly: ".xlsx 파일만 고를 수 있어요.",
    pickFile: "엑셀 파일을 고르세요",
    tooLarge: "파일은 10MB 이하여야 해요.",
  },
};
