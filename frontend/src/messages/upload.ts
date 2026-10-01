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
  // TODO(파일 저장소 미정, decisions.md 2026-09-28): 업로드 기능 구현 시 실제 등록 흐름으로 교체
  pending: (name: string) => `'${name}' 확인 완료. 파일 등록은 준비 중이에요`,
};
