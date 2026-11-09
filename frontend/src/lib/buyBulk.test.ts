import { describe, expect, it } from "vitest";
import type { CartBulkResult, CartBulkRowApi, ListingOption } from "@/types/cartBulk";
import { buyReducer, canSelect, errorsOf, initialBuyState, isLocked, summary, toCheckRow, toCommitRow, type BuyState } from "./buyBulk";

const TODAY = "2026-11-09";

const row = (rowNo: number, patch: Partial<CartBulkRowApi> = {}): CartBulkRowApi => ({
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
  ...patch,
});

const option = (sellerId: string, price = 1000, reason: string | null = null): ListingOption => ({
  sellerId,
  regDate: "20261105100000",
  sellerNickname: sellerId,
  unitPrice: price,
  stock: 10,
  minOrder: 1,
  orderUnit: 1,
  deliveryDate: "2099-12-31",
  replaceHint: null,
  reason,
});

const result = (rowNo: number, status: CartBulkResult["status"], fields: Record<string, string> = {}, chosen: ListingOption | null = null): CartBulkResult => ({
  rowNo,
  status,
  prodId: status === "FAILED" ? null : "KP-1",
  matchedName: status === "FAILED" ? null : "스위치",
  chosen,
  options: chosen ? [chosen] : [],
  alternatives: [],
  candidates: [],
  notices: [],
  fields,
  substituted: false,
});

/** 2: 매물 있음, 3: 매물 없음, 4: 실패(수량) */
function loaded(): BuyState {
  return buyReducer(initialBuyState, {
    type: "loaded",
    rows: [row(2), row(3), row(4, { orderQuantity: "0" })],
    results: [result(2, "AVAILABLE", {}, option("A")), result(3, "UNAVAILABLE"), result(4, "FAILED", { orderQuantity: "서버 사유" })],
    cartCount: 5,
    cartMax: 100,
  });
}

describe("buyReducer", () => {
  it("읽으면 살 매물이 골라진 줄만 체크하고, 장바구니 줄 수를 담는다", () => {
    const s = loaded();
    expect(s.lines.map((l) => [l.rowNo, l.selected])).toEqual([
      [2, true],
      [3, false],
      [4, false],
    ]);
    expect(summary(s.lines)).toEqual({ available: 1, unavailable: 1, failed: 1, selected: 1, added: 0 });
    expect([s.cartCount, s.cartMax]).toEqual([5, 100]);
  });

  it("매물 없음·오류 줄은 체크가 막힌다", () => {
    let s = buyReducer(loaded(), { type: "toggled", rowNo: 3 });
    s = buyReducer(s, { type: "toggled", rowNo: 4 });
    expect(s.lines[1].selected).toBe(false);
    expect(s.lines[2].selected).toBe(false);
    expect(canSelect(s.lines[1])).toBe(false);
    expect(canSelect(s.lines[2])).toBe(false);
  });

  it("칸을 고치면 그 칸의 서버 오류가 지워지고 형식 오류가 즉시 붙는다", () => {
    let s = buyReducer(loaded(), { type: "edited", rowNo: 4, field: "orderQuantity", value: "abc", today: TODAY });
    expect(errorsOf(s.lines[2]).orderQuantity).toBeDefined();
    expect(s.lines[2].dirty).toBe(true);
    s = buyReducer(s, { type: "edited", rowNo: 4, field: "orderQuantity", value: "5", today: TODAY });
    expect(errorsOf(s.lines[2])).toEqual({});
  });

  it("체크한 줄을 고쳐 오류가 생기면 체크가 풀린다", () => {
    const s = buyReducer(loaded(), { type: "edited", rowNo: 2, field: "orderQuantity", value: "0", today: TODAY });
    expect(s.lines[0].selected).toBe(false);
  });

  it("다시 검사 중에는 체크할 수 없고, 결과가 오면 갱신되며 체크는 풀려 있다", () => {
    let s = buyReducer(loaded(), { type: "checking", rowNo: 2 });
    expect(canSelect(s.lines[0])).toBe(false);
    s = buyReducer(s, { type: "rechecked", results: [result(2, "AVAILABLE", {}, option("B", 900))], cartCount: 7 });
    expect(s.lines[0].result.chosen?.sellerId).toBe("B");
    expect(s.lines[0].checking).toBe(false);
    expect(s.lines[0].selected).toBe(false);
    expect(s.cartCount).toBe(7);
    s = buyReducer(s, { type: "toggled", rowNo: 2 });
    expect(s.lines[0].selected).toBe(true);
  });

  it("상품을 고치면 전에 고른 매물이 지워지지만, 수량을 고치면 고른 매물은 그대로다", () => {
    let s = buyReducer(loaded(), { type: "chose", rowNo: 2, sellerId: "B", regDate: "20261105100001" });
    s = buyReducer(s, { type: "edited", rowNo: 2, field: "orderQuantity", value: "9", today: TODAY });
    expect(s.lines[0].fields).toMatchObject({ sellerId: "B", regDate: "20261105100001" });
    s = buyReducer(s, { type: "edited", rowNo: 2, field: "prodName", value: "다른 상품", today: TODAY });
    expect(s.lines[0].fields).toMatchObject({ sellerId: "", regDate: "" });
  });

  it("다른 매물을 고르면 sellerId·regDate 가 채워지고 이 칸의 listing 오류가 지워진다", () => {
    let s = buyReducer(loaded(), { type: "rechecked", results: [result(2, "FAILED", { listing: "재고(1)가 수량보다 적어요." })] });
    expect(errorsOf(s.lines[0]).listing).toBeDefined();
    s = buyReducer(s, { type: "chose", rowNo: 2, sellerId: "C", regDate: "20261105100002" });
    expect(s.lines[0].fields).toMatchObject({ sellerId: "C", regDate: "20261105100002" });
    expect(errorsOf(s.lines[0]).listing).toBeUndefined();
  });

  it("검사에는 사용자가 직접 고른 매물만 보내고, 담기에는 화면에 보인 매물을 명시한다", () => {
    const s = loaded();
    expect(toCheckRow(s.lines[0])).toMatchObject({ rowNo: 2, sellerId: null, regDate: null, remarks: null });
    expect(toCommitRow(s.lines[0])).toMatchObject({ sellerId: "A", regDate: "20261105100000" });
    // 고른 매물이 없는 줄은 그대로
    expect(toCommitRow(s.lines[1])).toMatchObject({ sellerId: null, regDate: null });
  });

  it("마스터를 고르면 상품 칸이 잠기고 고른 매물·잠기는 칸의 입력 오류가 지워진다", () => {
    let s = buyReducer(loaded(), { type: "edited", rowNo: 3, field: "prodClassNo", value: "x".repeat(21), today: TODAY });
    expect(errorsOf(s.lines[1]).prodClassNo).toBeDefined();
    s = buyReducer(s, { type: "chose", rowNo: 3, sellerId: "Z", regDate: "1" });
    s = buyReducer(s, { type: "picked", rowNo: 3, pick: { prodId: "KP-9", prodName: "스위치 C9300", prodBrand: "Cisco", prodClassNo: "CLS-1" } });
    expect(isLocked(s.lines[1])).toBe(true);
    expect(s.lines[1].fields).toMatchObject({ prodId: "KP-9", prodName: "스위치 C9300", prodClassNo: "CLS-1", sellerId: "", regDate: "" });
    expect(errorsOf(s.lines[1]).prodClassNo).toBeUndefined();
    // 잠긴 칸은 고쳐지지 않고, 다른 칸은 고칠 수 있다
    s = buyReducer(s, { type: "edited", rowNo: 3, field: "prodName", value: "다른 상품", today: TODAY });
    expect(s.lines[1].fields.prodName).toBe("스위치 C9300");
    s = buyReducer(s, { type: "edited", rowNo: 3, field: "orderQuantity", value: "9", today: TODAY });
    expect(s.lines[1].fields.orderQuantity).toBe("9");
  });

  it("[직접 입력으로 바꾸기]: prodId 와 고른 매물이 비고 상품 칸은 마스터 값이 남은 채 편집할 수 있다", () => {
    let s = buyReducer(loaded(), { type: "picked", rowNo: 3, pick: { prodId: "KP-9", prodName: "스위치 C9300", prodBrand: "Cisco", prodClassNo: null } });
    s = buyReducer(s, { type: "unlocked", rowNo: 3 });
    expect(isLocked(s.lines[1])).toBe(false);
    expect(s.lines[1].fields).toMatchObject({ prodId: "", prodName: "스위치 C9300" });
    s = buyReducer(s, { type: "edited", rowNo: 3, field: "prodName", value: "다른 상품", today: TODAY });
    expect(toCheckRow(s.lines[1])).toMatchObject({ prodId: null, prodName: "다른 상품" });
  });

  it("엑셀에 상품 ID 가 있던 줄도 잠겨 있다", () => {
    const s = buyReducer(initialBuyState, { type: "loaded", rows: [row(2, { prodId: "KP-1" })], results: [result(2, "AVAILABLE", {}, option("A"))], cartCount: 0, cartMax: 100 });
    expect(isLocked(s.lines[0])).toBe(true);
  });

  it("담기 결과: 담긴 줄은 담김으로 남아 수정·체크가 막히고, 실패한 줄은 사유와 함께 남는다. 담은 건수·장바구니 줄 수는 갱신", () => {
    let s = buyReducer(loaded(), {
      type: "committed",
      outcomes: [
        { rowNo: 2, ok: true, code: null, message: null },
        { rowNo: 3, ok: false, code: "NO_LISTING", message: "살 수 있는 매물이 없어요." },
      ],
      cartCount: 6,
    });
    expect(s.lines[0]).toMatchObject({ added: true, selected: false });
    expect(s.lines[1]).toMatchObject({ added: false, selected: false, addError: "살 수 있는 매물이 없어요." });
    expect(s.added).toBe(1);
    expect(s.cartCount).toBe(6);
    expect(summary(s.lines)).toEqual({ available: 0, unavailable: 1, failed: 1, selected: 0, added: 1 });

    // 담은 줄은 고치기·체크·재검사·선택이 막힌다
    s = buyReducer(s, { type: "edited", rowNo: 2, field: "orderQuantity", value: "9", today: TODAY });
    s = buyReducer(s, { type: "toggled", rowNo: 2 });
    s = buyReducer(s, { type: "checking", rowNo: 2 });
    s = buyReducer(s, { type: "rechecked", results: [result(2, "FAILED", { prodName: "x" })] });
    s = buyReducer(s, { type: "selectVisible", rowNos: [2], value: true });
    expect(s.lines[0]).toMatchObject({ added: true, selected: false, checking: false });
    expect(s.lines[0].fields.orderQuantity).toBe("3");
    expect(s.lines[0].result.status).toBe("AVAILABLE");
  });

  it("실패한 줄을 고치거나 다시 검사하면 담기 실패 사유가 지워진다", () => {
    let s = buyReducer(loaded(), { type: "committed", outcomes: [{ rowNo: 2, ok: false, code: "CART_FULL", message: "가득 찼어요" }], cartCount: 100 });
    expect(s.lines[0].addError).toBe("가득 찼어요");
    s = buyReducer(s, { type: "edited", rowNo: 2, field: "orderQuantity", value: "4", today: TODAY });
    expect(s.lines[0].addError).toBeNull();
  });

  it("보이는 줄만 선택한다: selectVisible 은 넘긴 줄만 바꾸고 못 고르는 줄은 선택하지 않는다", () => {
    let s = buyReducer(loaded(), { type: "selectVisible", rowNos: [2, 2], value: false });
    s = buyReducer(s, { type: "selectVisible", rowNos: [3, 4], value: true });
    expect(s.lines.map((l) => [l.rowNo, l.selected])).toEqual([
      [2, false],
      [3, false],
      [4, false],
    ]);
    s = buyReducer(s, { type: "selectVisible", rowNos: [2], value: true });
    expect(s.lines[0].selected).toBe(true);
  });
});
