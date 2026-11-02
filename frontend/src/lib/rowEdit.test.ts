import { describe, expect, it } from "vitest";
import { applyDetailToItem, replaceRow } from "./rowEdit";
import type { ListingDetail, ListingSearchItem } from "@/types/listing";

const detail: ListingDetail = {
  userId: "11111111-1111-1111-1111-111111111111",
  regDate: "20261001090000",
  prodId: "ELEC00010001",
  prodName: "R740",
  prodBrand: "Dell",
  prodNo: "R740-A",
  prodSpecInfo: null,
  prodClassNo: null,
  prodUsefulLife: null,
  warrantyMethod: null,
  alterProdName: null,
  tradeType: "등록",
  prodState: "신품대비 70%",
  salesUnitPrice: 1000,
  salesQuantity: 12,
  minOrderQuantity: 1,
  orderUnit: 1,
  deliveryDate: null,
  stockQuantity: null,
  description: "설명",
  listingDataSheet: "private/listings/datasheets/2026/10/a.pdf",
  photos: ["public/listings/photos/2026/10/p1.jpg", "public/listings/photos/2026/10/p2.jpg"],
  warrantyPeriod: 360,
  warrantyCoverage: "대체",
  replaceProd: null,
  testReport: "private/listings/test-reports/2026/10/t.pdf",
  certificateOfAuthen: null,
  dtUpdate: null,
  dtExpire: null,
  category: "임시",
  categoryPath: null,
  mufcDate: "2020-05-01",
  tradeStatus: "available",
  warrantyUntil: null,
};

describe("applyDetailToItem", () => {
  const item: ListingSearchItem = {
    userId: detail.userId,
    regDate: detail.regDate,
    prodNo: null,
    prodName: "옛 이름",
    prodBrand: "옛 제조사",
    category: "임시",
    mufcDate: null,
    prodDescription: null,
    hasDataSheet: false,
    hasPhoto: false,
    warrantyUntil: null,
    warrantyCoverage: null,
    hasReplaceProd: false,
    hasTestReport: false,
    hasCertificate: false,
    prodState: "신품",
    stockQuantity: null,
    salesUnitPrice: 1,
    deliveryDate: null,
    tradeStatus: "available",
    minOrderQuantity: 5,
    orderUnit: 10,
    categoryPath: "옛 > 경로",
  };

  it("저장 응답(상세)의 값으로 표의 행을 갱신한다 — 새 상품으로 옮겨졌으면 그 상품 값, 파일은 유무로", () => {
    expect(applyDetailToItem(item, { ...detail, replaceProd: "private/r.pdf", certificateOfAuthen: null })).toMatchObject({
      prodName: "R740",
      prodBrand: "Dell",
      prodNo: "R740-A",
      mufcDate: "2020-05-01",
      prodDescription: "설명",
      hasDataSheet: true,
      hasPhoto: true,
      warrantyCoverage: "대체",
      hasReplaceProd: true,
      hasTestReport: true,
      hasCertificate: false,
      prodState: "신품대비 70%",
      salesUnitPrice: 1000,
      minOrderQuantity: 1,
      orderUnit: 1,
      categoryPath: null,
      userId: detail.userId,
      regDate: detail.regDate,
    });
  });

  it("사진·설명을 비우면 없음으로", () => {
    expect(applyDetailToItem(item, { ...detail, photos: [], description: null, listingDataSheet: null })).toMatchObject({
      hasPhoto: false,
      prodDescription: null,
      hasDataSheet: false,
    });
  });

  describe("replaceRow", () => {
    const other: ListingSearchItem = { ...item, regDate: "20260101000000", prodName: "다른 매물" };

    it("구매한 행만 재고·거래상태가 바뀌고 다른 행은 그대로(같은 참조)", () => {
      const next = replaceRow([other, item], { ...detail, stockQuantity: 0, tradeStatus: "completed" });
      expect(next[0]).toBe(other);
      expect(next[1]).toMatchObject({ stockQuantity: 0, tradeStatus: "completed" });
    });

    it("목록에 없는 매물이면 그대로", () => {
      expect(replaceRow([other], detail)).toEqual([other]);
    });
  });
});
