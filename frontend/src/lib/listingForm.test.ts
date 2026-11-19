import { describe, expect, it } from "vitest";
import { toCreateRequest, todayInSeoul } from "./listingForm";
import { emptyListingForm, listingFormSchema, type ListingFormInput } from "./validation/listing";

const output = (over: Partial<ListingFormInput>) => {
  const r = listingFormSchema("2026-10-02").safeParse({
    ...emptyListingForm,
    categoryCode: " ELEC0001 ",
    prodName: "R740",
    prodBrand: "Dell",
    prodState: "신품",
    salesUnitPrice: "1000",
    salesQuantity: "3",
    deliveryDate: "2026-10-02",
    photos: ["k0"],
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
  it("필수 칸(대표 사진 포함)만: 거래종류 판매, 신품, 선택 칸은 보내지 않는다", () => {
    const req = toCreateRequest(output({}));
    expect(req).toEqual({
      categoryCode: "ELEC0001",
      prodName: "R740",
      prodBrand: "Dell",
      tradeType: "등록",
      prodState: "신품",
      salesUnitPrice: 1000,
      salesQuantity: 3,
      deliveryDate: "2026-10-02",
      photos: ["k0"],
    });
  });

  it("상품마스터를 골랐으면 prodId 와 매물 칸만 보내고 상품 칸은 보내지 않는다 (사진을 안 올려도 된다)", () => {
    const req = toCreateRequest(
      output({
        prodId: "KP-2026-000001",
        masterPhoto: "public/listings/photos/2026/10/m.jpg",
        prodNo: "MASTER-1",
        prodSpecInfo: "마스터 사양",
        photos: [],
      }),
    );
    expect(req).toEqual({
      prodId: "KP-2026-000001",
      tradeType: "등록",
      prodState: "신품",
      salesUnitPrice: 1000,
      salesQuantity: 3,
      deliveryDate: "2026-10-02",
    });
  });

  it("직접 입력이면 상품 새 칸 4개를 보내고(보증년수는 숫자, 빈 칸은 빼기), 마스터를 골랐으면 안 보낸다", () => {
    const manual = toCreateRequest(output({ prodClassNo: "43211503", prodUsefulLife: "24", warrantyMethod: "제조사 보증", alterProdName: "" }));
    expect(manual).toMatchObject({ prodClassNo: "43211503", prodUsefulLife: 24, warrantyMethod: "제조사 보증" });
    expect("alterProdName" in manual).toBe(false);
    const picked = toCreateRequest(
      output({ prodId: "KP-2026-000001", masterPhoto: "m.jpg", prodClassNo: "X", prodUsefulLife: "3", warrantyMethod: "W", alterProdName: "A" }),
    );
    for (const key of ["prodClassNo", "prodUsefulLife", "warrantyMethod", "alterProdName"]) {
      expect(key in picked).toBe(false);
    }
  });

  it("상품마스터를 고르지 않으면 prodId 없이 상품 칸을 보낸다", () => {
    expect("prodId" in toCreateRequest(output({}))).toBe(false);
  });

  it("상품상태는 고른 값 그대로", () => {
    expect(toCreateRequest(output({ prodState: "신품대비 80~89%" })).prodState).toBe("신품대비 80~89%");
  });

  it("납기일은 그대로, 제조일(2026-11-04 삭제)은 요청에 없다", () => {
    const req = toCreateRequest(output({ deliveryDate: "2026-10-10" }));
    expect(req.deliveryDate).toBe("2026-10-10");
    expect("prodMufcDate" in req).toBe(false);
  });

  it("선택 칸을 채우면 함께 보내고 사진 순서를 지킨다", () => {
    const req = toCreateRequest(
      output({
        prodNo: " MODEL-1 ",
        prodSpecInfo: "2U",
        description: "설명",
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
      minOrderQuantity: 2,
      orderUnit: 1,
      photos: ["k1", "k2"],
      listingDataSheet: "sheet",
    });
  });
});
