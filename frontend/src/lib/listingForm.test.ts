import { describe, expect, it } from "vitest";
import { toCreateRequest, todayInSeoul } from "./listingForm";
import { emptyListingForm, listingFormSchema, type ListingFormInput } from "./validation/listing";

const output = (over: Partial<ListingFormInput>) => {
  const r = listingFormSchema("2026-10-02").safeParse({
    ...emptyListingForm,
    categoryCode: " ELEC0001 ",
    prodName: "R740",
    prodBrand: "Dell",
    salesUnitPrice: "1000",
    salesQuantity: "3",
    ...over,
  });
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
};

describe("todayInSeoul", () => {
  it("UTC 시각을 한국 날짜로 바꾼다", () => {
    expect(todayInSeoul(new Date("2026-10-01T23:30:00Z"))).toBe("2026-10-02");
    expect(todayInSeoul(new Date("2026-10-02T14:59:00Z"))).toBe("2026-10-02");
    expect(todayInSeoul(new Date("2026-10-02T15:00:00Z"))).toBe("2026-10-03");
  });
});

describe("toCreateRequest", () => {
  it("필수 칸만: 거래종류 판매, 신품, 선택 칸은 보내지 않는다", () => {
    const req = toCreateRequest(output({}));
    expect(req).toEqual({
      categoryCode: "ELEC0001",
      prodName: "R740",
      prodBrand: "Dell",
      tradeType: "등록",
      prodState: "신품",
      salesUnitPrice: 1000,
      salesQuantity: 3,
    });
  });

  it("중고 85 → 신품대비 85%", () => {
    expect(toCreateRequest(output({ condition: "used", usedPercent: "85" })).prodState).toBe("신품대비 85%");
  });

  it("제조일은 yyyyMMdd, 납기일은 그대로", () => {
    const req = toCreateRequest(output({ prodMufcDate: "2020-01-31", deliveryDate: "2026-10-10" }));
    expect(req.prodMufcDate).toBe("20200131");
    expect(req.deliveryDate).toBe("2026-10-10");
  });

  it("선택 칸을 채우면 함께 보내고 사진 순서를 지킨다", () => {
    const req = toCreateRequest(
      output({
        prodNo: " MODEL-1 ",
        prodSpecInfo: "2U",
        description: "설명",
        stockQuantity: "0",
        minOrderQuantity: "2",
        orderUnit: "1",
        photos: ["k1", "k2"],
        listingDataSheet: "sheet",
      }),
    );
    expect(req).toMatchObject({
      prodNo: "MODEL-1",
      prodSpecInfo: "2U",
      description: "설명",
      stockQuantity: 0,
      minOrderQuantity: 2,
      orderUnit: 1,
      photos: ["k1", "k2"],
      listingDataSheet: "sheet",
    });
  });
});
