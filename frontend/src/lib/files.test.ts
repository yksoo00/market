import { describe, expect, it } from "vitest";
import { isSafeFileType } from "@/lib/files";

describe("isSafeFileType", () => {
  it("업로드 정책의 형식(pdf·jpg·png·webp)만 허용", () => {
    for (const type of ["application/pdf", "image/jpeg", "image/png", "image/webp"]) expect(isSafeFileType(type)).toBe(true);
    for (const type of ["text/html", "image/svg+xml", "application/octet-stream", ""]) expect(isSafeFileType(type)).toBe(false);
  });
});
