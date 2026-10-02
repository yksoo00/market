import { describe, expect, it } from "vitest";
import type { ListingDetail } from "@/types/listing";
import {
  buyerActionsDisabled,
  dataSheetKey,
  formatRegDate,
  infoRows,
  isAuthLost,
  isOwner,
  isValidListingPath,
  mainPhoto,
} from "@/lib/listingDetail";

const UUID = "3f2b6c1e-8a4d-4f7b-9c21-5d0e7a9b1c11";

const base: ListingDetail = {
  userId: UUID,
  regDate: "20261001091500",
  prodId: "ELEC00010001",
  prodName: "LM324AD",
  prodBrand: "STMICROELECTRONICS",
  prodNo: "LM324AD",
  prodSpecInfo: null,
  tradeType: "등록",
  prodState: "양호",
  salesUnitPrice: 320,
  salesQuantity: 1200,
  minOrderQuantity: 10,
  orderUnit: 5,
  deliveryDate: "2026-10-08",
  stockQuantity: 1200,
  description: null,
  listingDataSheet: null,
  photos: [],
  warrantyPeriod: null,
  warrantyCoverage: null,
  replaceProd: null,
  testReport: null,
  certificateOfAuthen: null,
  dtUpdate: null,
  dtExpire: null,
  category: "ELEC0001",
  mufcDate: "2026-09-10",
  productDataSheet: null,
  productPhoto: null,
  tradeStatus: "available",
  warrantyUntil: null,
};

describe("isValidListingPath", () => {
  it("UUID(대소문자 무관) + 14자리 숫자만 통과", () => {
    expect(isValidListingPath(UUID, "20261001091500")).toBe(true);
    expect(isValidListingPath(UUID.toUpperCase(), "20261001091500")).toBe(true);
    expect(isValidListingPath("abc", "20261001091500")).toBe(false);
    expect(isValidListingPath(UUID, "2026100109")).toBe(false);
    expect(isValidListingPath(UUID, "2026100109150a")).toBe(false);
  });
});

describe("formatRegDate", () => {
  it("yyyyMMddHHmmss → YYYY-MM-DD HH:mm", () => {
    expect(formatRegDate("20261001091500")).toBe("2026-10-01 09:15");
  });
});

describe("mainPhoto", () => {
  it("매물 사진 첫 장, 없으면 상품 사진, 둘 다 없으면 null", () => {
    expect(mainPhoto({ ...base, photos: ["a.jpg", "b.jpg"], productPhoto: "p.jpg" })).toBe("a.jpg");
    expect(mainPhoto({ ...base, photos: [], productPhoto: "p.jpg" })).toBe("p.jpg");
    expect(mainPhoto(base)).toBeNull();
  });
});

describe("dataSheetKey", () => {
  it("매물 데이터시트, 없으면 상품 데이터시트, 둘 다 없으면 null", () => {
    expect(dataSheetKey({ ...base, listingDataSheet: "l.pdf", productDataSheet: "p.pdf" })).toBe("l.pdf");
    expect(dataSheetKey({ ...base, productDataSheet: "p.pdf" })).toBe("p.pdf");
    expect(dataSheetKey(base)).toBeNull();
  });
});

describe("isOwner", () => {
  it("대소문자 무시 비교, meId 가 null 이면 false", () => {
    expect(isOwner(UUID.toUpperCase(), UUID)).toBe(true);
    expect(isOwner("a81d4e9f-2c6b-4b3a-8e57-1f9c0d2e6a22", UUID)).toBe(false);
    expect(isOwner(null, UUID)).toBe(false);
  });
});

describe("isAuthLost", () => {
  it("refresh 까지 실패한 401 코드만 로그인이 풀린 것, 네트워크·5xx·429 는 아님", () => {
    for (const code of ["UNAUTHENTICATED", "SESSION_EXPIRED", "UNAUTHORIZED"]) expect(isAuthLost(code)).toBe(true);
    for (const code of ["UNREACHABLE", "SERVER_ERROR", "RATE_LIMITED", "FORBIDDEN"]) expect(isAuthLost(code)).toBe(false);
  });
});

describe("buyerActionsDisabled", () => {
  it("거래완료면 true, 거래 가능이면 false", () => {
    expect(buyerActionsDisabled({ ...base, tradeStatus: "completed" })).toBe(true);
    expect(buyerActionsDisabled(base)).toBe(false);
  });
});

describe("infoRows", () => {
  it("이미지에 있던 행 먼저, 나머지 컬럼 뒤 — 순서·라벨 고정", () => {
    expect(infoRows(base).map((r) => r.label)).toEqual([
      "제조사",
      "상품코드",
      "리드 타임",
      "상태",
      "단가",
      "수량",
      "카테고리",
      "거래종류",
      "제조일",
      "최소주문수량",
      "주문단위",
      "등록수량",
      "보증기한",
      "불량지원",
      "등록일",
    ]);
  });

  it("단가는 천 단위 + 원, 수량은 천 단위", () => {
    const value = (d: ListingDetail, label: string) => infoRows(d).find((r) => r.label === label)?.value;
    expect(value(base, "단가")).toBe("320원");
    expect(value({ ...base, salesUnitPrice: 3_500_000 }, "단가")).toBe("3,500,000원");
    expect(value(base, "수량")).toBe("1,200");
    expect(value(base, "등록일")).toBe("2026-10-01 09:15");
  });

  it("빈 값은 – 로, 상품코드는 mono", () => {
    const rows = infoRows({ ...base, deliveryDate: null, stockQuantity: null });
    expect(rows.find((r) => r.label === "리드 타임")?.value).toBe("–");
    expect(rows.find((r) => r.label === "수량")?.value).toBe("–");
    expect(rows.find((r) => r.label === "상품코드")?.mono).toBe(true);
  });
});
