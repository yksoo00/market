import { beforeEach, describe, expect, it } from "vitest";
import type { BulkResult, BulkRowApi } from "@/types/listingBulk";
import { bulkReducer, initialBulkState, type BulkState } from "./bulkListing";
import { BULK_STORAGE_KEY, clearBulk, loadBulk, saveBulk } from "./bulkStorage";

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

const row = (rowNo: number): BulkRowApi => ({
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
});

const result = (rowNo: number): BulkResult => ({ rowNo, status: "MATCHED", prodId: "KP-1", matchedName: "스위치", candidates: [], notices: [], fields: {} });

const state = (): BulkState => bulkReducer(initialBulkState, { type: "loaded", rows: [row(2), row(3)], results: [result(2), result(3)] });

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
});

describe("작업 보관", () => {
  it("저장한 상태를 그대로 읽는다", () => {
    const s = bulkReducer(state(), { type: "edited", rowNo: 2, field: "salesQuantity", value: "9", today: "2026-11-05" });
    saveBulk(s, storage);
    expect(loadBulk(storage)).toEqual(s);
  });

  it("검사 중(checking)이던 줄은 읽으면 검사 중이 아니다 — 응답이 영영 안 오는 상태로 남지 않게", () => {
    const s = bulkReducer(state(), { type: "checking", rowNo: 2 });
    saveBulk(s, storage);
    expect(loadBulk(storage)?.lines[0].checking).toBe(false);
  });

  it("깨진 JSON·모양이 다른 값·버전이 다른 값은 버리고(null) 지운다", () => {
    storage.setItem(BULK_STORAGE_KEY, "{깨짐");
    expect(loadBulk(storage)).toBeNull();
    expect(storage.getItem(BULK_STORAGE_KEY)).toBeNull();

    storage.setItem(BULK_STORAGE_KEY, JSON.stringify({ version: 1, state: { lines: "x", created: 0 } }));
    expect(loadBulk(storage)).toBeNull();

    storage.setItem(BULK_STORAGE_KEY, JSON.stringify({ version: 999, state: state() }));
    expect(loadBulk(storage)).toBeNull();
    expect(storage.getItem(BULK_STORAGE_KEY)).toBeNull();
  });

  it("줄이 없는 상태를 저장하면 보관본을 지운다 (빈 보관본을 이어서 보여 주지 않게)", () => {
    saveBulk(state(), storage);
    saveBulk(initialBulkState, storage);
    expect(loadBulk(storage)).toBeNull();
  });

  it("clearBulk 후에는 없다", () => {
    saveBulk(state(), storage);
    clearBulk(storage);
    expect(loadBulk(storage)).toBeNull();
  });

  it("저장소가 던져도(용량 초과·차단) 예외 없이 넘긴다", () => {
    const broken = new MemoryStorage();
    broken.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(() => saveBulk(state(), broken)).not.toThrow();
    broken.getItem = () => {
      throw new Error("SecurityError");
    };
    expect(loadBulk(broken)).toBeNull();
    expect(() => clearBulk(broken)).not.toThrow();
  });
});
