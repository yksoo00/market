import { API_BASE, fetchFile } from "@/lib/api/client";
import type { ApiResult } from "@/types/api";

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

/**
 * 비공개 파일을 새 탭에서 연다. await 뒤에 탭을 열면 팝업 차단에 걸리므로 클릭 순간(첫 await 전) 빈 탭을 먼저 열고,
 * 받은 뒤 주소를 blob URL 로 채운다. 실패하면 열어 둔 탭을 닫는다.
 */
export async function openFileInNewTab(
  key: string,
  openTab: () => Window | null = () => window.open("", "_blank"),
): Promise<ApiResult<null>> {
  const tab = openTab();
  if (!tab) return { ok: false, code: "POPUP_BLOCKED", message: "" };
  const res = await fetchFile(filePath(key));
  if (!res.ok) {
    tab.close();
    return res;
  }
  if (!isSafeFileType(res.data.type)) {
    tab.close();
    return { ok: false, code: "UNSUPPORTED_FILE", message: "" };
  }
  const url = URL.createObjectURL(res.data);
  tab.location.href = url;
  // 새 탭이 읽는 중일 수 있어 바로 해제하지 않는다
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { ok: true, data: null };
}
