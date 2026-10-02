import { API_BASE } from "@/lib/api/client";

// 저장소 키(예: public/listings/photos/2026/10/<uuid>.jpg)의 "/"는 폴더 구분이라 인코딩하지 않는다
export function filePath(key: string): string {
  return `/api/v1/files/${key}`;
}

/** 공개 파일(사진)을 <img src>·링크에 바로 쓸 때. 비공개 파일은 fetchFile(filePath(key)) 로 */
export function fileUrl(key: string): string {
  return API_BASE + filePath(key);
}
