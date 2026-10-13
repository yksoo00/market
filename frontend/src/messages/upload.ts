export const upload = {
  format: {
    excel: "엑셀 파일(.xlsx, .xls)만 올릴 수 있어요. 파일 형식을 확인하세요",
    pdf: "PDF 파일(.pdf)만 올릴 수 있어요. 파일 형식을 확인하세요",
    image: "이미지는 jpg, png, webp만 올릴 수 있어요. 파일 형식을 확인하세요",
  },
  size: {
    excel: "엑셀 파일은 10MB 이하로 올려 주세요",
    pdf: "PDF 파일은 10MB 이하로 올려 주세요",
    image: "이미지는 한 장에 5MB 이하로 올려 주세요",
  },
  empty: "빈 파일이에요. 내용이 있는 파일을 선택하세요",
  // 서버 코드 → 문구 (POST /api/v1/uploads). 없는 코드는 서버 message 그대로
  errors: {
    UPLOAD_INVALID_TYPE: "올릴 수 없는 파일이에요. 확장자와 실제 파일 형식이 맞는지 확인하세요",
    UPLOAD_TOO_LARGE: "파일이 너무 커요. 사진은 5MB, 문서는 10MB 이하로 올려 주세요",
    RATE_LIMITED: "파일을 너무 자주 올렸어요. 10분 뒤 다시 시도해 주세요",
    UPLOAD_QUOTA_EXCEEDED: "오늘 올릴 수 있는 파일 용량(300MB)을 다 썼어요. 내일 다시 올려 주세요",
    // 503 이라 lib/api 가 서버 오류로 바꿔 돌려주므로 지금은 쓰이지 않는다. 백엔드 코드 목록과 맞추려고 둔다
    STORAGE_FULL: "지금은 파일을 올릴 수 없어요. 잠시 후 다시 시도해 주세요",
  } as Record<string, string>,
  // TODO(파일 저장소 미정, decisions.md 2026-09-28): 업로드 기능 구현 시 실제 등록 흐름으로 교체
  pending: (name: string) => `'${name}' 확인 완료. 파일 등록은 준비 중이에요`,
};
