import { beforeEach, describe, expect, it } from "vitest";
import type { CartBulkResult, CartBulkRowApi } from "@/types/cartBulk";
import { buyReducer, initialBuyState, type BuyState } from "./buyBulk";
import { BUY_STORAGE_KEY, clearBuyBulk, loadBuyBulk, saveBuyBulk } from "./buyBulkStorage";

/** Vitest(node) 에는 sessionStorage 가 없어 같은 인터페이스의 메모리 대역을 쓴다 */
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const row = (rowNo: number): CartBulkRowApi => ({
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
});

const result = (rowNo: number): CartBulkResult => ({
  rowNo,
  status: "UNAVAILABLE",
  prodId: "KP-1",
  matchedName: "스위치",
  chosen: null,
  options: [],
  alternatives: [],
  notices: [],
  fields: {},
  substituted: false,
  masterCount: 1,
});

const state = (): BuyState => buyReducer(initialBuyState, { type: "loaded", rows: [row(2), row(3)], results: [result(2), result(3)], cartCount: 4, cartMax: 100 });

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
});

describe("대량구매 작업 보관", () => {
  it("저장한 상태를 그대로 읽는다", () => {
    const s = buyReducer(state(), { type: "edited", rowNo: 2, field: "orderQuantity", value: "9", today: "2026-11-09" });
    saveBuyBulk(s, storage);
    expect(loadBuyBulk(storage)).toEqual(s);
  });

  it("검사 중(checking)이던 줄은 읽으면 검사 중이 아니다", () => {
    saveBuyBulk(buyReducer(state(), { type: "checking", rowNo: 2 }), storage);
    expect(loadBuyBulk(storage)?.lines[0].checking).toBe(false);
  });

  it("깨진 JSON·모양이 다른 값·버전이 다른 값은 버리고(null) 지운다", () => {
    storage.setItem(BUY_STORAGE_KEY, "{깨짐");
    expect(loadBuyBulk(storage)).toBeNull();
    expect(storage.getItem(BUY_STORAGE_KEY)).toBeNull();

    storage.setItem(BUY_STORAGE_KEY, JSON.stringify({ version: 4, state: { lines: "x", added: 0, cartCount: 0, cartMax: 100 } }));
    expect(loadBuyBulk(storage)).toBeNull();

    storage.setItem(BUY_STORAGE_KEY, JSON.stringify({ version: 999, state: state() }));
    expect(loadBuyBulk(storage)).toBeNull();
    expect(storage.getItem(BUY_STORAGE_KEY)).toBeNull();
  });

  it("화면이 읽는 칸이 빠진 보관본(result.options 없음·fields 일부 없음)은 버리고 지운다", () => {
    const broken = JSON.parse(JSON.stringify(state())) as BuyState;
    delete (broken.lines[0].result as Partial<CartBulkResult>).options;
    storage.setItem(BUY_STORAGE_KEY, JSON.stringify({ version: 4, state: broken }));
    expect(loadBuyBulk(storage)).toBeNull();
    expect(storage.getItem(BUY_STORAGE_KEY)).toBeNull();

    const noField = JSON.parse(JSON.stringify(state())) as BuyState;
    delete (noField.lines[0].fields as Partial<BuyState["lines"][0]["fields"]>).orderQuantity;
    storage.setItem(BUY_STORAGE_KEY, JSON.stringify({ version: 4, state: noField }));
    expect(loadBuyBulk(storage)).toBeNull();
  });

  it("옛 규칙(v1·v2·v3)의 보관본은 읽지 않고 지운다 — 미리 고르던 낡은 선택이 남지 않게", () => {
    for (const key of ["market.buyBulk.v1", "market.buyBulk.v2", "market.buyBulk.v3"]) {
      storage.setItem(key, JSON.stringify({ version: 2, state: state() }));
      expect(loadBuyBulk(storage)).toBeNull();
      expect(storage.getItem(key)).toBeNull();
      storage.setItem(key, "x");
      clearBuyBulk(storage);
      expect(storage.getItem(key)).toBeNull();
    }
  });

  it("후보 매물에 특성(traits)이 빠진 보관본은 버린다 — 후보 팝업이 읽다 죽는다", () => {
    const broken = JSON.parse(JSON.stringify(state())) as BuyState;
    broken.lines[0].result.options = [{ sellerId: "S" } as unknown as BuyState["lines"][0]["result"]["options"][0]];
    storage.setItem(BUY_STORAGE_KEY, JSON.stringify({ version: 4, state: broken }));
    expect(loadBuyBulk(storage)).toBeNull();
  });

  it("줄이 없는 상태를 저장하면 보관본을 지운다, clearBuyBulk 후에는 없다", () => {
    saveBuyBulk(state(), storage);
    saveBuyBulk(initialBuyState, storage);
    expect(loadBuyBulk(storage)).toBeNull();
    saveBuyBulk(state(), storage);
    clearBuyBulk(storage);
    expect(loadBuyBulk(storage)).toBeNull();
  });

  it("저장소가 던져도(용량 초과·차단) 예외 없이 넘긴다", () => {
    const broken = new MemoryStorage();
    broken.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(() => saveBuyBulk(state(), broken)).not.toThrow();
    broken.getItem = () => {
      throw new Error("SecurityError");
    };
    expect(loadBuyBulk(broken)).toBeNull();
    expect(() => clearBuyBulk(broken)).not.toThrow();
  });
});
