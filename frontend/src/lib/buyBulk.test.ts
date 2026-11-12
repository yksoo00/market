import { describe, expect, it } from "vitest";
import type { CartBulkResult, CartBulkRowApi, ListingOption } from "@/types/cartBulk";
import { blockedOptions, cleanOptions, isClean, softOptions, buyReducer, canSelect, errorsOf, initialBuyState, isLocked, markDuplicates, summary, toCheckRow, toCommitRow, type BuyState } from "./buyBulk";
import { buyBulk } from "@/messages/buyBulk";

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
  mismatches: [],
  traits,
});

const result = (rowNo: number, status: CartBulkResult["status"], fields: Record<string, string> = {}, chosen: ListingOption | null = null): CartBulkResult => ({
  rowNo,
  status,
  prodId: status === "FAILED" ? null : `KP-${rowNo}`,
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
  it("조건을 고치면 직접 고른 매물과 그 사유(listing)가 비워지고 서버가 기본 매물을 다시 정한다, 수량은 그대로 둔다", () => {
    const picked = buyReducer(loaded(), { type: "chose", rowNo: 2, sellerId: "B", regDate: "20261105100001" });
    const edited = buyReducer(picked, { type: "edited", rowNo: 2, field: "maxPrice", value: "500", today: TODAY });
    expect(edited.lines[0].fields).toMatchObject({ maxPrice: "500", sellerId: "", regDate: "" });
    expect(toCheckRow(edited.lines[0])).toMatchObject({ maxPrice: "500", sellerId: null, regDate: null });

    const withListingError = buyReducer(loaded(), { type: "rechecked", results: [result(2, "FAILED", { listing: "상한을 넘어요" })] });
    const cleared = buyReducer(withListingError, { type: "edited", rowNo: 2, field: "minState", value: "신품", today: TODAY });
    expect(errorsOf(cleared.lines[0]).listing).toBeUndefined();

    const qty = buyReducer(picked, { type: "edited", rowNo: 2, field: "orderQuantity", value: "4", today: TODAY });
    expect(qty.lines[0].fields.sellerId).toBe("B");
  });

  it("조건 칸의 형식 오류가 바로 붙고, 조건은 검사·담기 요청에 실린다 (비면 null)", () => {
    const bad = buyReducer(loaded(), { type: "edited", rowNo: 2, field: "minWarrantyMonths", value: "5", today: TODAY });
    expect(errorsOf(bad.lines[0]).minWarrantyMonths).toBe(buyBulk.validation.minWarrantyMonths);
    expect(canSelect(bad.lines[0])).toBe(false);

    let s = buyReducer(loaded(), { type: "edited", rowNo: 2, field: "needDataSheet", value: "Y", today: TODAY });
    s = buyReducer(s, { type: "edited", rowNo: 2, field: "minState", value: "신품대비 80~89%", today: TODAY });
    expect(toCheckRow(s.lines[0])).toMatchObject({ needDataSheet: "Y", minState: "신품대비 80~89%", maxPrice: null, needPhoto: null });
    expect(toCommitRow(s.lines[0])).toMatchObject({ needDataSheet: "Y", minState: "신품대비 80~89%" });
  });

  it("엑셀에 적힌 조건이 줄 칸으로 들어온다", () => {
    const s = buyReducer(initialBuyState, {
      type: "loaded",
      rows: [row(2, { minState: "신품", maxPrice: "1500000", minWarrantyMonths: "6", needCertificate: "Y" })],
      results: [result(2, "UNAVAILABLE")],
      cartCount: 0,
      cartMax: 100,
    });
    expect(s.lines[0].fields).toMatchObject({ minState: "신품", maxPrice: "1500000", minWarrantyMonths: "6", needCertificate: "Y", needPhoto: "" });
  });

  it("엑셀의 \"12개월\"·겹공백 상태는 드롭다운 값으로 맞춰 읽고 입력 검사에 안 걸린다", () => {
    const s = buyReducer(initialBuyState, { type: "loaded", rows: [row(2, { minState: " 신품대비  80~89% ", minWarrantyMonths: "12 개월", maxPrice: "1 000" })], results: [result(2, "UNAVAILABLE")], cartCount: 0, cartMax: 100 });
    expect(s.lines[0].fields).toMatchObject({ minState: "신품대비 80~89%", minWarrantyMonths: "12" });
    const edited = buyReducer(s, { type: "edited", rowNo: 2, field: "orderQuantity", value: "4", today: TODAY });
    expect(errorsOf(edited.lines[0])).toEqual({});
  });

  it("매물 카드 세 구역: 조건에 맞는 것(clean) / 조건과 다른 것(soft) / 고를 수 없는 것(blocked) — 서버가 보낸 순서를 그대로 지킨다", () => {
    const soft = { ...option("S", 5), mismatches: ["단가가 상한을 넘어요"] };
    const hard = option("H", 4, "재고 부족");
    const ok1 = option("O1", 6);
    const ok2 = option("O2", 7);
    const r = { ...result(2, "CHOOSE"), options: [hard, ok1, soft, ok2] };
    expect(isClean(ok1)).toBe(true);
    expect(isClean(soft)).toBe(false);
    expect(isClean(hard)).toBe(false);
    expect(cleanOptions(r)).toEqual([ok1, ok2]);
    expect(softOptions(r)).toEqual([soft]);
    expect(blockedOptions(r)).toEqual([hard]);
  });

  it("다시 검사해도 같은 매물이 그대로면 체크를 유지하고, 고른 매물이 바뀌거나 없어지면 푼다", () => {
    const checked = loaded(); // 2행: 매물 A 가 골라져 있고 체크됨
    expect(checked.lines[0].selected).toBe(true);
    const same = buyReducer(checked, { type: "rechecked", results: [result(2, "AVAILABLE", {}, option("A", 900))] });
    expect(same.lines[0].selected).toBe(true);
    const changed = buyReducer(checked, { type: "rechecked", results: [result(2, "AVAILABLE", {}, option("B", 800))] });
    expect(changed.lines[0].selected).toBe(false);
    const gone = buyReducer(checked, { type: "rechecked", results: [{ ...result(2, "CHOOSE"), options: [option("A"), option("B")] }] });
    expect(gone.lines[0].selected).toBe(false);
  });

  it("선택 필요(CHOOSE) 줄은 체크할 수 없고, 직접 매물을 고르면(AVAILABLE) 담을 수 있다", () => {
    const loadedChoose = buyReducer(initialBuyState, { type: "loaded", rows: [row(2)], results: [{ ...result(2, "CHOOSE"), options: [option("A", 1), option("B", 2)] }], cartCount: 0, cartMax: 100 });
    expect(canSelect(loadedChoose.lines[0])).toBe(false);
    expect(loadedChoose.lines[0].selected).toBe(false);
    expect(summary(loadedChoose.lines).choose).toBe(1);

    const picked = buyReducer(loadedChoose, { type: "rechecked", results: [result(2, "AVAILABLE", {}, option("B", 2))] });
    expect(canSelect(picked.lines[0])).toBe(true);
    expect(summary(picked.lines)).toMatchObject({ choose: 0, available: 1 });
  });

  it("조건과 다른 매물을 고르면 담을 수 있는 줄이 되고, 고른 매물에 다른 점이 남는다", () => {
    const soft = { ...option("S", 5), mismatches: ["단가가 상한을 넘어요"] };
    const s = buyReducer(loaded(), { type: "rechecked", results: [result(3, "AVAILABLE", {}, soft)] });
    expect(canSelect(s.lines[1])).toBe(true);
    expect(s.lines[1].result.chosen?.mismatches).toEqual(["단가가 상한을 넘어요"]);
    expect(toCommitRow(s.lines[1])).toMatchObject({ sellerId: "S" });
  });

  it("읽으면 살 매물이 골라진 줄만 체크하고, 장바구니 줄 수를 담는다", () => {
    const s = loaded();
    expect(s.lines.map((l) => [l.rowNo, l.selected])).toEqual([
      [2, true],
      [3, false],
      [4, false],
    ]);
    expect(summary(s.lines)).toEqual({ choose: 0, available: 1, unavailable: 1, failed: 1, selected: 1, added: 0 });
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
    expect(summary(s.lines)).toEqual({ choose: 0, available: 0, unavailable: 1, failed: 1, selected: 0, added: 1 });

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

  it("[상품 찾기]로 마스터를 고르면 다시 검사 결과가 오기 전에는 담을 수 없다 (옛 매물이 새 상품과 같이 담기는 일을 막는다)", () => {
    const base = loaded();
    for (const action of [
      { type: "picked", rowNo: 2, pick: { prodId: "KP-9", prodName: "다른", prodBrand: "Cisco", prodClassNo: null } },
      { type: "unlocked", rowNo: 2 },
      { type: "chose", rowNo: 2, sellerId: "B", regDate: "1" },
    ] as const) {
      expect(buyReducer(base, action).lines[0].selected).toBe(false);
    }
  });

  describe("파일 안 중복 — 화면이 줄 전체를 보고 정한다 (한 줄만 다시 검사하면 서버가 다른 줄을 못 봐서)", () => {
    /** 2·3 이 같은 마스터(KP-X). 서버는 parse 때 3 에 중복 오류를 달았다 */
    function dupState(): BuyState {
      const a = { ...result(2, "AVAILABLE", {}, option("A")), prodId: "KP-X" };
      const b = { ...result(3, "AVAILABLE", { prodName: buyBulk.duplicate }, option("A")), prodId: "KP-X" };
      return buyReducer(initialBuyState, { type: "loaded", rows: [row(2), row(3)], results: [a, b], cartCount: 0, cartMax: 100 });
    }

    it("뒤 줄만 중복이고 서버가 단 낡은 중복 오류는 지워진다", () => {
      const s = dupState();
      expect(s.lines.map((l) => l.duplicate)).toEqual([false, true]);
      expect(s.lines[1].result.fields).toEqual({});
      expect(errorsOf(s.lines[1]).prodName).toBe(buyBulk.duplicate);
      expect(canSelect(s.lines[1])).toBe(false);
    });

    it("뒤 줄을 고쳐 다시 검사해도(서버는 그 줄만 보므로 통과) 같은 마스터면 중복이 유지된다", () => {
      let s = buyReducer(dupState(), { type: "rechecked", results: [{ ...result(3, "AVAILABLE", {}, option("A")), prodId: "KP-X" }] });
      expect(s.lines[1].duplicate).toBe(true);
      expect(errorsOf(s.lines[1]).prodName).toBe(buyBulk.duplicate);
      // 다른 상품으로 바뀌어 다시 검사되면 풀린다
      s = buyReducer(s, { type: "rechecked", results: [{ ...result(3, "AVAILABLE", {}, option("A")), prodId: "KP-Y" }] });
      expect(s.lines[1].duplicate).toBe(false);
      expect(errorsOf(s.lines[1])).toEqual({});
    });

    it("앞 줄이 다른 상품으로 바뀌면 뒤 줄이 앞 줄이 된다", () => {
      const s = buyReducer(dupState(), { type: "rechecked", results: [{ ...result(2, "AVAILABLE", {}, option("A")), prodId: "KP-Z" }] });
      expect(s.lines.map((l) => l.duplicate)).toEqual([false, false]);
    });

    it("담은 줄은 중복 판정에서 빠진다", () => {
      const s = buyReducer(dupState(), { type: "committed", outcomes: [{ rowNo: 2, ok: true, code: null, message: null }], cartCount: 1 });
      expect(s.lines.map((l) => l.duplicate)).toEqual([false, false]);
    });

    it("보관본에서 되살려도 markDuplicates 로 다시 정해진다", () => {
      const stale = { ...dupState(), lines: dupState().lines.map((l) => ({ ...l, duplicate: false })) };
      expect(markDuplicates(stale).lines.map((l) => l.duplicate)).toEqual([false, true]);
    });
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
