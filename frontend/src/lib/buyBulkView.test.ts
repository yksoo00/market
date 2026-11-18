import { describe, expect, it } from "vitest";
import type { CartBulkResult, CartBulkRowApi, ListingOption } from "@/types/cartBulk";
import { buyReducer, initialBuyState, type BuyState } from "./buyBulk";
import { initialBuyView, tabCounts, tabOf, visibleLines, type BuyView } from "./buyBulkView";

const row = (rowNo: number, patch: Partial<CartBulkRowApi>): CartBulkRowApi => ({
  rowNo,
  prodId: null,
  prodName: "스위치",
  prodBrand: "Cisco",
  prodClassNo: null,
  orderQuantity: "3",
  reqDeliDate: "2026-12-01",
  remarks: null,
  sellerId: null,
  regDate: null,
  minState: null,
  maxPrice: null,
  minWarrantyMonths: null,
  needDataSheet: null,
  needPhoto: null,
  needCoverage: null,
  needTestReport: null,
  needCertificate: null,
  ...patch,
});

const traits = { prodState: "신품", warrantyDays: null, hasDataSheet: false, hasPhoto: false, warrantyCoverage: null, hasTestReport: false, hasCertificate: false };

const option = (price: number): ListingOption => ({
  sellerId: "S",
  regDate: "20261105100000",
  sellerNickname: "S",
  unitPrice: price,
  stock: 10,
  minOrder: 1,
  orderUnit: 1,
  deliveryDate: null,
  replaceHint: null,
  reason: null,
  mismatches: [],
  traits,
  prodId: "KP-1",
  prodName: "스위치",
  prodBrand: "Cisco",
  prodClassNo: null,
});

const result = (rowNo: number, status: CartBulkResult["status"], chosen: ListingOption | null, fields: Record<string, string> = {}, matchedName: string | null = null): CartBulkResult => ({
  rowNo,
  status,
  prodId: status === "FAILED" ? null : `KP-${rowNo}`,
  matchedName,
  chosen,
  options: [],
  alternatives: [],
  notices: [],
  fields,
  substituted: false,
  masterCount: status === "FAILED" ? 0 : 1,
});

/** 2: 있음 가나다 Cisco 수량 5 단가 3000, 3: 없음 라우터 Juniper 수량 100, 4: 실패 허브 cisco 수량 "1,500", 5: 있음 서버 Dell 수량 글자 단가 100 */
function lines(): BuyState["lines"] {
  return buyReducer(initialBuyState, {
    type: "loaded",
    rows: [
      row(2, { prodName: "가나다", orderQuantity: "5" }),
      row(3, { prodName: "라우터", prodBrand: "Juniper", orderQuantity: "100" }),
      row(4, { prodName: "허브", prodBrand: "cisco", orderQuantity: "1,500" }),
      row(5, { prodName: "서버", prodBrand: "Dell", orderQuantity: "몇개" }),
    ],
    results: [
      result(2, "AVAILABLE", option(3000), {}, "가나다 마스터"),
      result(3, "UNAVAILABLE", null),
      result(4, "FAILED", null, { prodName: "사유" }),
      result(5, "AVAILABLE", option(100)),
    ],
    cartCount: 0,
    cartMax: 100,
  }).lines;
}

const view = (patch: Partial<BuyView>): BuyView => ({ ...initialBuyView, ...patch });
const rowNos = (v: BuyView, l = lines()) => visibleLines(l, v).map((x) => x.rowNo);

describe("탭", () => {
  it("줄은 매물 있음·매물 없음·확인 필요·담김 중 하나에 속한다", () => {
    expect(lines().map(tabOf)).toEqual(["available", "unavailable", "failed", "available"]);
  });

  it("전체는 담김을 뺀 모든 줄, 담김 탭은 담은 줄만. 개수도 같은 기준", () => {
    const added = buyReducer({ ...initialBuyState, lines: lines() }, { type: "committed", outcomes: [{ rowNo: 2, ok: true, code: null, message: null }], cartCount: 1 }).lines;
    expect(rowNos(view({ tab: "all" }), added)).toEqual([3, 4, 5]);
    expect(rowNos(view({ tab: "done" }), added)).toEqual([2]);
    expect(tabCounts(added)).toEqual({ all: 3, choose: 0, available: 1, unavailable: 1, failed: 1, done: 1 });
  });

  it("탭별로 걸러낸다", () => {
    expect(rowNos(view({ tab: "available" }))).toEqual([2, 5]);
    expect(rowNos(view({ tab: "unavailable" }))).toEqual([3]);
    expect(rowNos(view({ tab: "failed" }))).toEqual([4]);
  });
});

describe("검색", () => {
  it("상품명·제조사·마스터 이름에서 대소문자 무시 부분일치", () => {
    expect(rowNos(view({ query: "CISCO" }))).toEqual([2, 4]);
    expect(rowNos(view({ query: "라우" }))).toEqual([3]);
    expect(rowNos(view({ query: "가나다 마스터" }))).toEqual([2]);
    expect(rowNos(view({ query: "  " }))).toEqual([2, 3, 4, 5]);
    expect(rowNos(view({ query: "없는상품" }))).toEqual([]);
  });

  it("탭과 함께 적용된다", () => {
    expect(rowNos(view({ tab: "failed", query: "허브" }))).toEqual([4]);
    expect(rowNos(view({ tab: "available", query: "허브" }))).toEqual([]);
  });
});

describe("정렬", () => {
  it("정렬이 없으면 엑셀 행 번호 순", () => {
    expect(rowNos(view({}))).toEqual([2, 3, 4, 5]);
  });

  it("글자는 가나다순, 수량은 수치(쉼표 제거), 값이 없는 칸(글자 수량·매물 없는 단가)은 방향과 상관없이 맨 뒤", () => {
    expect(rowNos(view({ sort: { key: "prodName", dir: "asc" } }))).toEqual([2, 3, 5, 4]); // 가나다 라우터 서버 허브
    expect(rowNos(view({ sort: { key: "orderQuantity", dir: "asc" } }))).toEqual([2, 3, 4, 5]); // 5 100 1500 글자
    expect(rowNos(view({ sort: { key: "orderQuantity", dir: "desc" } }))).toEqual([4, 3, 2, 5]);
    expect(rowNos(view({ sort: { key: "unitPrice", dir: "asc" } }))).toEqual([5, 2, 3, 4]); // 100 3000, 단가 없는 줄은 뒤
    expect(rowNos(view({ sort: { key: "unitPrice", dir: "desc" } }))).toEqual([2, 5, 3, 4]);
  });

  it("상태 정렬은 오류 먼저 → 매물 없음 → 매물 있음", () => {
    expect(rowNos(view({ sort: { key: "status", dir: "asc" } }))).toEqual([4, 3, 2, 5]);
  });

  it("정렬해도 입력 배열은 바뀌지 않는다", () => {
    const l = lines();
    const before = l.map((x) => x.rowNo);
    expect(visibleLines(l, view({ sort: { key: "prodName", dir: "desc" } })).map((x) => x.rowNo)).toEqual([4, 5, 3, 2]);
    expect(l.map((x) => x.rowNo)).toEqual(before);
  });
});
