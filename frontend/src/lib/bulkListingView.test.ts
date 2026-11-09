import { describe, expect, it } from "vitest";
import type { BulkResult, BulkRowApi } from "@/types/listingBulk";
import { bulkReducer, initialBulkState, type BulkState } from "./bulkListing";
import { initialBulkView, nextSortFor, tabCounts, tabOf, visibleLines, type BulkView } from "./bulkListingView";

const TODAY = "2026-11-05";

const row = (rowNo: number, patch: Partial<BulkRowApi> = {}): BulkRowApi => ({
  rowNo,
  prodId: null,
  prodName: "스위치",
  prodBrand: "Cisco",
  prodClassNo: null,
  prodNo: null,
  categoryCode: null,
  prodState: "신품",
  salesUnitPrice: "1000",
  salesQuantity: "3",
  minOrderQuantity: null,
  orderUnit: null,
  deliveryDate: "2026-12-01",
  description: null,
  ...patch,
});

const result = (rowNo: number, status: BulkResult["status"], fields: Record<string, string> = {}, matchedName: string | null = null): BulkResult => ({
  rowNo,
  status,
  prodId: status === "MATCHED" ? "KP-1" : null,
  matchedName,
  candidates: [],
  notices: [],
  fields,
});

/** 2: 찾음 가나다 Cisco 3000, 3: 새 상품 라우터 Juniper 100, 4: 실패 허브 cisco "1,500", 5: 찾음 서버 Dell 단가 글자 */
function lines(): BulkState["lines"] {
  return bulkReducer(initialBulkState, {
    type: "loaded",
    rows: [
      row(2, { prodName: "가나다", salesUnitPrice: "3000" }),
      row(3, { prodName: "라우터", prodBrand: "Juniper", salesUnitPrice: "100" }),
      row(4, { prodName: "허브", prodBrand: "cisco", salesUnitPrice: "1,500" }),
      row(5, { prodName: "서버", prodBrand: "Dell", salesUnitPrice: "오백" }),
    ],
    results: [result(2, "MATCHED", {}, "가나다 마스터"), result(3, "NEW_MASTER"), result(4, "FAILED", { salesQuantity: "사유" }), result(5, "MATCHED")],
  }).lines;
}

const view = (patch: Partial<BulkView>): BulkView => ({ ...initialBulkView, ...patch });
const rowNos = (v: BulkView, l = lines()) => visibleLines(l, v).map((x) => x.rowNo);

describe("탭", () => {
  it("줄은 등록 가능·새 상품·확인 필요·등록됨 중 하나에 속한다 (오류가 있으면 새 상품이어도 확인 필요)", () => {
    const l = lines();
    expect(l.map(tabOf)).toEqual(["ok", "new", "failed", "ok"]);
    const withError = bulkReducer({ lines: l, created: 0 }, { type: "edited", rowNo: 3, field: "salesQuantity", value: "0", today: TODAY }).lines;
    expect(tabOf(withError[1])).toBe("failed");
  });

  it("전체는 등록됨을 뺀 모든 줄, 등록됨 탭은 등록된 줄만. 개수도 같은 기준", () => {
    const committed = bulkReducer({ lines: lines(), created: 0 }, { type: "committed", rowNos: [2] }).lines;
    expect(rowNos(view({ tab: "all" }), committed)).toEqual([3, 4, 5]);
    expect(rowNos(view({ tab: "done" }), committed)).toEqual([2]);
    expect(tabCounts(committed)).toEqual({ all: 3, ok: 1, new: 1, failed: 1, done: 1 });
  });

  it("탭별로 걸러낸다", () => {
    expect(rowNos(view({ tab: "ok" }))).toEqual([2, 5]);
    expect(rowNos(view({ tab: "new" }))).toEqual([3]);
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
    expect(rowNos(view({ tab: "ok", query: "허브" }))).toEqual([]);
  });
});

describe("정렬", () => {
  it("정렬이 없으면 엑셀 행 번호 순", () => {
    expect(rowNos(view({}))).toEqual([2, 3, 4, 5]);
  });

  it("글자는 가나다순, 숫자는 수치(쉼표 제거)로, 숫자가 아닌 칸은 방향과 상관없이 맨 뒤", () => {
    expect(rowNos(view({ sort: { key: "prodName", dir: "asc" } }))).toEqual([2, 3, 5, 4]); // 가나다 라우터 서버 허브
    expect(rowNos(view({ sort: { key: "salesUnitPrice", dir: "asc" } }))).toEqual([3, 4, 2, 5]); // 100 1500 3000 오백
    expect(rowNos(view({ sort: { key: "salesUnitPrice", dir: "desc" } }))).toEqual([2, 4, 3, 5]);
  });

  it("상태 정렬은 오류 먼저 → 새 상품 → 마스터 찾음", () => {
    expect(rowNos(view({ sort: { key: "status", dir: "asc" } }))).toEqual([4, 3, 2, 5]);
  });

  it("같은 값이면 행 번호 순이라 결과가 매번 같다", () => {
    expect(rowNos(view({ sort: { key: "salesQuantity", dir: "desc" } }))).toEqual([2, 3, 4, 5]);
  });

  it("정렬해도 입력 배열은 바뀌지 않는다", () => {
    const l = lines();
    const before = l.map((x) => x.rowNo);
    expect(visibleLines(l, view({ sort: { key: "prodName", dir: "desc" } })).map((x) => x.rowNo)).toEqual([4, 5, 3, 2]);
    expect(l.map((x) => x.rowNo)).toEqual(before);
  });
});

describe("nextSortFor", () => {
  it("열 머리를 누르면 오름 → 내림 → 해제, 다른 열은 오름부터", () => {
    let v = view({});
    v = view({ sort: nextSortFor(v, "prodName") });
    expect(v.sort).toEqual({ key: "prodName", dir: "asc" });
    v = view({ sort: nextSortFor(v, "prodName") });
    expect(v.sort).toEqual({ key: "prodName", dir: "desc" });
    v = view({ sort: nextSortFor(v, "prodName") });
    expect(v.sort).toBeNull();
    v = view({ sort: nextSortFor(view({ sort: { key: "prodName", dir: "desc" } }), "salesQuantity") });
    expect(v.sort).toEqual({ key: "salesQuantity", dir: "asc" });
  });
});
