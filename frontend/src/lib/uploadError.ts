import { listing } from "@/messages/listing";
import { upload } from "@/messages/upload";
import type { ApiFail } from "@/types/api";

/** 업로드 실패 → 사용자 문구. 업로드 전용 문구 → 매물 공통(로그인 만료 등) → 서버 message 순 */
export function uploadErrorMessage(fail: ApiFail): string {
  return upload.errors[fail.code] ?? listing.errors[fail.code] ?? fail.message;
}
