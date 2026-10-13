import { describe, expect, it } from "vitest";
import { upload as t } from "@/messages/upload";
import { acceptOf, checkUpload } from "./upload";

const MB = 1024 * 1024;

describe("checkUpload", () => {
  it("형식·크기가 맞으면 null", () => {
    expect(checkUpload("excel", { name: "목록.xlsx", size: 2 * MB })).toBeNull();
    expect(checkUpload("excel", { name: "old.xls", size: 2 * MB })).toBeNull();
    expect(checkUpload("pdf", { name: "견적서.pdf", size: 10 * MB })).toBeNull();
    expect(checkUpload("image", { name: "사진.webp", size: 5 * MB })).toBeNull();
  });

  it("확장자는 대소문자를 가리지 않는다", () => {
    expect(checkUpload("image", { name: "IMG_0001.JPG", size: MB })).toBeNull();
  });

  it("다른 형식이면 형식 오류", () => {
    expect(checkUpload("excel", { name: "목록.csv", size: MB })).toBe(t.format.excel);
    expect(checkUpload("pdf", { name: "견적서.docx", size: MB })).toBe(t.format.pdf);
    expect(checkUpload("image", { name: "사진.gif", size: MB })).toBe(t.format.image);
  });

  it("확장자가 없으면 형식 오류", () => {
    expect(checkUpload("excel", { name: "xlsx", size: MB })).toBe(t.format.excel);
  });

  it("한도를 1바이트라도 넘으면 크기 오류", () => {
    expect(checkUpload("excel", { name: "a.xlsx", size: 10 * MB + 1 })).toBe(t.size.excel);
    expect(checkUpload("image", { name: "a.png", size: 5 * MB + 1 })).toBe(t.size.image);
  });

  it("빈 파일은 거부", () => {
    expect(checkUpload("pdf", { name: "a.pdf", size: 0 })).toBe(t.empty);
  });
});

describe("acceptOf", () => {
  it("파일 선택창 accept 값", () => {
    expect(acceptOf("excel")).toBe(".xlsx,.xls");
    expect(acceptOf("image")).toBe(".jpg,.jpeg,.png,.webp");
  });
});
