import { describe, expect, it } from "vitest";
import {
  applyDetailToItem,
  diffToRowPatch,
  rowEditInitialValues,
  validateRowEdit,
  type RowEditValues,
} from "./rowEdit";
import type { ListingDetail, ListingSearchItem } from "@/types/listing";

const detail: ListingDetail = {
  userId: "11111111-1111-1111-1111-111111111111",
  regDate: "20261001090000",
  prodId: "ELEC00010001",
  prodName: "R740",
  prodBrand: "Dell",
  prodNo: "R740-A",
  prodSpecInfo: null,
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
  mufcDate: "2020-05-01",
  tradeStatus: "available",
  warrantyUntil: null,
};

const initial: RowEditValues = rowEditInitialValues(detail);

describe("rowEditInitialValues", () => {
  it("상품 칸은 문자열(없으면 빈 문자열), 상태는 구간, 보증은 개월", () => {
    expect(initial).toMatchObject({
      prodName: "R740",
      prodBrand: "Dell",
      prodNo: "R740-A",
      prodMufcDate: "2020-05-01",
      prodState: "신품대비 70~79%",
      warrantyMonths: 12,
      warrantyCoverage: "대체",
      description: "설명",
      replaceProd: "",
      testReport: "private/listings/test-reports/2026/10/t.pdf",
    });
    expect(rowEditInitialValues({ ...detail, prodNo: null, mufcDate: null }).prodNo).toBe("");
    expect(rowEditInitialValues({ ...detail, prodNo: null, mufcDate: null }).prodMufcDate).toBe("");
  });
});

describe("diffToRowPatch", () => {
  it("아무것도 안 바꾸면 빈 객체 — 옛 상태값(신품대비 70%)·옛 보증(365)도 다시 보내지 않는다", () => {
    expect(diffToRowPatch(initial, { ...initial })).toEqual({});
  });

  it("바뀐 상품 칸만, 앞뒤 공백은 잘라서", () => {
    expect(diffToRowPatch(initial, { ...initial, prodName: "  R750 ", prodBrand: "HP" })).toEqual({ prodName: "R750", prodBrand: "HP" });
  });

  it("공백만 바꾼 이름·설명은 바뀐 것이 아니다", () => {
    expect(diffToRowPatch(initial, { ...initial, prodName: "R740 ", description: " 설명 " })).toEqual({});
  });

  it("상품번호·제조일을 지우면 빈 문자열(비우기), 제조일은 yyyyMMdd 로", () => {
    expect(diffToRowPatch(initial, { ...initial, prodNo: "" })).toEqual({ prodNo: "" });
    expect(diffToRowPatch(initial, { ...initial, prodMufcDate: "" })).toEqual({ prodMufcDate: "" });
    expect(diffToRowPatch(initial, { ...initial, prodMufcDate: "2021-12-31" })).toEqual({ prodMufcDate: "20211231" });
  });

  it("상품상태를 고르면 그 값", () => {
    expect(diffToRowPatch(initial, { ...initial, prodState: "신품" })).toEqual({ prodState: "신품" });
  });

  it("보증 개월이 바뀌면 일수로, 불량지원은 문자열", () => {
    expect(diffToRowPatch(initial, { ...initial, warrantyMonths: 24 })).toEqual({ warrantyPeriod: 720 });
    expect(diffToRowPatch(initial, { ...initial, warrantyMonths: 0 })).toEqual({ warrantyPeriod: 0 });
    expect(diffToRowPatch(initial, { ...initial, warrantyCoverage: "" })).toEqual({ warrantyCoverage: "" });
  });

  it("사진은 순서만 바뀌어도 바뀐 것, 전부 지우면 []", () => {
    const [a, b] = initial.photos;
    expect(diffToRowPatch(initial, { ...initial, photos: [b, a] })).toEqual({ photos: [b, a] });
    expect(diffToRowPatch(initial, { ...initial, photos: [] })).toEqual({ photos: [] });
  });

  it("파일 칸을 지우면 빈 문자열, 새 키로 바꾸면 새 키", () => {
    expect(diffToRowPatch(initial, { ...initial, listingDataSheet: "" })).toEqual({ listingDataSheet: "" });
    expect(diffToRowPatch(initial, { ...initial, testReport: "private/x.pdf" })).toEqual({ testReport: "private/x.pdf" });
    expect(diffToRowPatch(initial, { ...initial, certificateOfAuthen: "private/c.pdf" })).toEqual({ certificateOfAuthen: "private/c.pdf" });
  });
});

describe("validateRowEdit", () => {
  const today = "2026-10-06";
  const check = (over: Partial<RowEditValues>) => validateRowEdit(initial, { ...initial, ...over }, today);

  it("정상 값이면 오류 없음", () => {
    expect(validateRowEdit(initial, { ...initial }, today)).toEqual({});
  });

  it("상품명·제조사는 공백뿐이면 필수 오류, 50자 넘으면 길이 오류", () => {
    expect(check({ prodName: "   " }).prodName).toMatch(/필수/);
    expect(check({ prodBrand: "" }).prodBrand).toMatch(/필수/);
    expect(check({ prodName: "가".repeat(51) }).prodName).toMatch(/50자/);
  });

  it("상품번호 20자 초과, 설명 200자 초과", () => {
    expect(check({ prodNo: "A".repeat(21) }).prodNo).toMatch(/20자/);
    expect(check({ description: "가".repeat(201) }).description).toMatch(/200자/);
  });

  it("제조일: 없는 날짜·미래는 오류, 비우기와 오늘은 통과", () => {
    expect(check({ prodMufcDate: "2026-13-01" }).prodMufcDate).toBeDefined();
    expect(check({ prodMufcDate: "2026-10-07" }).prodMufcDate).toBeDefined();
    expect(check({ prodMufcDate: "2026-10-06" })).toEqual({});
    expect(check({ prodMufcDate: "" })).toEqual({});
  });

  it("상품상태를 못 고른(빈 값, 옛 형식 매핑 실패) 채로 상태를 안 건드렸으면 통과 — 보내지 않으니까", () => {
    expect(check({ prodState: "" }).prodState).toBeUndefined();
  });

  it("처음부터 있던 값은 검사하지 않는다 — 옛 데이터(날짜로 안 읽히는 제조일·긴 이름)가 다른 칸 수정을 막지 않게", () => {
    const legacy = { ...initial, prodMufcDate: "2019", prodName: "가".repeat(60) };
    expect(validateRowEdit(legacy, { ...legacy }, today)).toEqual({});
    expect(validateRowEdit(legacy, { ...legacy, prodState: "신품" }, today)).toEqual({});
    // 건드리면 그때부터 검사
    expect(validateRowEdit(legacy, { ...legacy, prodMufcDate: "2019-13-45" }, today).prodMufcDate).toBeDefined();
    expect(validateRowEdit(legacy, { ...legacy, prodName: "가".repeat(61) }, today).prodName).toMatch(/50자/);
  });
});

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
});
