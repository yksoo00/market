import { API_BASE } from "@/lib/api/client";

// 저장소 키(예: public/listings/photos/2026/10/<uuid>.jpg)의 "/"는 폴더 구분이라 인코딩하지 않는다
export function filePath(key: string): string {
  return `/api/v1/files/${key}`;
}

/** 공개 파일(사진)을 <img src>·링크에 바로 쓸 때. 비공개 파일은 fetchFile(filePath(key)) 로 */
export function fileUrl(key: string): string {
  return API_BASE + filePath(key);
}

// 업로드 정책(security.md "파일 업로드")이 받는 형식. blob: URL 은 앱 출처를 물려받으므로, 서버가 언젠가 html·svg 를
// 내주더라도 앱 출처에서 스크립트가 돌지 않게 이 형식만 띄운다 (심층 방어)
const SAFE_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export function isSafeFileType(type: string): boolean {
  return SAFE_FILE_TYPES.has(type);
}
