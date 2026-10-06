import { describe, expect, it } from "vitest";
import { diffToUpdateRequest, editInitialValues, prodStateFromStored, type ListingEditValues } from "./listingEdit";
import type { ListingDetail } from "@/types/listing";

const detail: ListingDetail = {
  userId: "11111111-1111-1111-1111-111111111111",
  regDate: "20261001090000",
  prodId: "ELEC00010001",
  prodName: "R740",
  prodBrand: "Dell",
  prodNo: null,
  prodSpecInfo: null,
  tradeType: "등록",
  prodState: "신품대비 70%",
  salesUnitPrice: 1000,
  salesQuantity: 12,
  minOrderQuantity: 3,
  orderUnit: 3,
  deliveryDate: null,
  stockQuantity: null,
  description: null,
  listingDataSheet: "private/listings/datasheets/2026/10/a.pdf",
  photos: ["public/listings/photos/2026/10/p1.jpg", "public/listings/photos/2026/10/p2.jpg"],
  warrantyPeriod: null,
  warrantyCoverage: null,
  replaceProd: null,
  testReport: null,
  certificateOfAuthen: null,
  dtUpdate: null,
  dtExpire: null,
  category: "임시",
  mufcDate: null,
  tradeStatus: "available",
  warrantyUntil: null,
};

describe("prodStateFromStored", () => {
  it("목록 값은 그대로", () => {
    expect(prodStateFromStored("신품")).toBe("신품");
    expect(prodStateFromStored("신품대비 80~89%")).toBe("신품대비 80~89%");
    expect(prodStateFromStored("신품대비 50% 미만")).toBe("신품대비 50% 미만");
  });

  it("옛 형식 신품대비 N% 는 N 에 맞는 구간으로", () => {
    expect(prodStateFromStored("신품대비 99%")).toBe("신품대비 90~99%");
    expect(prodStateFromStored("신품대비 90%")).toBe("신품대비 90~99%");
    expect(prodStateFromStored("신품대비 70%")).toBe("신품대비 70~79%");
    expect(prodStateFromStored("신품대비 50%")).toBe("신품대비 50~59%");
    expect(prodStateFromStored("신품대비 49%")).toBe("신품대비 50% 미만");
    expect(prodStateFromStored("신품대비 1%")).toBe("신품대비 50% 미만");
    expect(prodStateFromStored("신품대비 100%")).toBe("신품");
  });

  it("구간에 안 맞는 값은 빈 값(선택하세요)", () => {
    expect(prodStateFromStored("양호")).toBe("");
    expect(prodStateFromStored("new")).toBe("");
    expect(prodStateFromStored("신품대비 05%")).toBe("");
  });
});

describe("editInitialValues", () => {
  it("숫자는 문자열로, null 은 빈 문자열로, 상태는 구간으로", () => {
    expect(editInitialValues(detail)).toEqual({
      prodState: "신품대비 70~79%",
      salesUnitPrice: "1000",
      salesQuantity: "12",
      stockQuantity: "",
      minOrderQuantity: "3",
      orderUnit: "3",
      deliveryDate: "",
      description: "",
      photos: ["public/listings/photos/2026/10/p1.jpg", "public/listings/photos/2026/10/p2.jpg"],
      listingDataSheet: "private/listings/datasheets/2026/10/a.pdf",
    });
  });
});

describe("diffToUpdateRequest", () => {
  const initial: ListingEditValues = editInitialValues(detail);

  it("아무것도 안 바꾸면 빈 객체", () => {
    expect(diffToUpdateRequest(initial, { ...initial })).toEqual({});
  });

  it("바뀐 칸만, 숫자 칸은 숫자로", () => {
    expect(diffToUpdateRequest(initial, { ...initial, salesUnitPrice: "900", stockQuantity: "5" })).toEqual({
      salesUnitPrice: 900,
      stockQuantity: 5,
    });
  });

  it("상태를 안 건드리면 옛 값(신품대비 70%)을 서버에 다시 보내지 않는다", () => {
    expect("prodState" in diffToUpdateRequest(initial, { ...initial })).toBe(false);
    expect(diffToUpdateRequest(initial, { ...initial, prodState: "신품" })).toEqual({ prodState: "신품" });
  });

  it("납기일·설명을 지우면 빈 문자열(비우기)", () => {
    const withValues = { ...initial, deliveryDate: "2026-12-01", description: "설명" };
    expect(diffToUpdateRequest(withValues, { ...withValues, deliveryDate: "", description: "" })).toEqual({
      deliveryDate: "",
      description: "",
    });
  });

  it("사진은 배열이 다를 때만(전부 지우면 [])", () => {
    expect("photos" in diffToUpdateRequest(initial, { ...initial })).toBe(false);
    expect(diffToUpdateRequest(initial, { ...initial, photos: [initial.photos[1]] })).toEqual({ photos: [initial.photos[1]] });
    expect(diffToUpdateRequest(initial, { ...initial, photos: [] })).toEqual({ photos: [] });
  });

  it("사진 순서만 바뀌어도 바뀐 것(첫 장이 대표 사진)", () => {
    const [a, b] = initial.photos;
    expect(diffToUpdateRequest(initial, { ...initial, photos: [b, a] })).toEqual({ photos: [b, a] });
  });

  it("데이터시트는 지우면 \"\", 바꾸면 새 키, 그대로면 생략", () => {
    expect(diffToUpdateRequest(initial, { ...initial, listingDataSheet: "" })).toEqual({ listingDataSheet: "" });
    expect(diffToUpdateRequest(initial, { ...initial, listingDataSheet: "private/listings/datasheets/2026/10/b.pdf" })).toEqual({
      listingDataSheet: "private/listings/datasheets/2026/10/b.pdf",
    });
    expect("listingDataSheet" in diffToUpdateRequest(initial, { ...initial })).toBe(false);
  });
});

describe("diffToUpdateRequest 공백", () => {
  it("설명 앞뒤 공백만 바뀐 건 바뀐 것이 아니다 (폼은 공백을 잘라 보낸다)", () => {
    const initial = { ...editInitialValues(detail), description: "abc" };
    expect(diffToUpdateRequest(initial, { ...initial, description: "abc " })).toEqual({});
    expect(diffToUpdateRequest(initial, { ...initial, description: " abcd " })).toEqual({ description: "abcd" });
  });
});
