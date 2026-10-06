import { upload as t } from "@/messages/upload";

// 수치는 docs/security.md "파일 업로드" 가 원본. 프론트는 확장자·크기만 즉시 검사하고,
// 매직 바이트 검사는 백엔드 몫 (브라우저가 주는 Content-Type 은 믿지 않는다).
const MB = 1024 * 1024;

export type UploadKind = "excel" | "pdf" | "image" | "doc";

const rules: Record<UploadKind, { exts: string[]; maxBytes: number }> = {
  excel: { exts: [".xlsx", ".xls"], maxBytes: 10 * MB },
  pdf: { exts: [".pdf"], maxBytes: 10 * MB },
  image: { exts: [".jpg", ".jpeg", ".png", ".webp"], maxBytes: 5 * MB },
  // 대체품·테스트리포트·정품인증서 (UploadKind 서버 정책: pdf·jpg·png, 10MB)
  doc: { exts: [".pdf", ".jpg", ".jpeg", ".png"], maxBytes: 10 * MB },
};

export function acceptOf(kind: UploadKind): string {
  return rules[kind].exts.join(",");
}

/** 통과하면 null, 아니면 사용자에게 보여줄 오류 문구 */
export function checkUpload(kind: UploadKind, file: { name: string; size: number }): string | null {
  const { exts, maxBytes } = rules[kind];
  const dot = file.name.lastIndexOf(".");
  const ext = dot < 0 ? "" : file.name.slice(dot).toLowerCase();
  if (!exts.includes(ext)) return t.format[kind];
  if (file.size === 0) return t.empty;
  if (file.size > maxBytes) return t.size[kind];
  return null;
}
