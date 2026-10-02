import { describe, expect, it } from "vitest";
import { listing } from "@/messages/listing";
import { upload } from "@/messages/upload";
import { uploadErrorMessage } from "./uploadError";

describe("uploadErrorMessage", () => {
  it("업로드 전용 문구가 먼저 — 429 RATE_LIMITED는 등록 한도가 아니라 업로드 한도 문구", () => {
    expect(uploadErrorMessage({ ok: false, code: "RATE_LIMITED", message: "x" })).toBe(upload.errors.RATE_LIMITED);
    expect(uploadErrorMessage({ ok: false, code: "UPLOAD_TOO_LARGE", message: "x" })).toBe(upload.errors.UPLOAD_TOO_LARGE);
  });

  it("로그인 만료(401)는 매물 공통 문구, 모르는 코드는 서버 문구", () => {
    expect(uploadErrorMessage({ ok: false, code: "UNAUTHORIZED", message: "x" })).toBe(listing.errors.UNAUTHORIZED);
    expect(uploadErrorMessage({ ok: false, code: "SOMETHING", message: "서버 문구" })).toBe("서버 문구");
  });
});
