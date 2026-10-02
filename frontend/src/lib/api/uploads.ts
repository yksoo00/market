import { upload } from "@/lib/api/client";
import type { ApiResult } from "@/types/api";
import type { ListingUploadKind } from "@/types/listing";

/** 파일을 먼저 올려 저장소 키를 받는다. 매물 등록·수정 요청에는 이 키를 넣는다 (2단계 업로드, decisions.md 2026-10-02) */
export function uploadFile(kind: ListingUploadKind, file: File): Promise<ApiResult<{ key: string }>> {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file);
  return upload<{ key: string }>("/api/v1/uploads", form);
}
