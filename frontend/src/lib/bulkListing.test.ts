import { describe, expect, it } from "vitest";
import { listing } from "@/messages/listing";
import type { BulkResult, BulkRowApi } from "@/types/listingBulk";
import { bulkReducer, canSelect, errorsOf, initialBulkState, selectedRows, summary, toApiRow, type BulkState } from "./bulkListing";

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

const result = (rowNo: number, status: BulkResult["status"], fields: Record<string, string> = {}): BulkResult => ({
  rowNo,
  status,
  prodId: status === "MATCHED" ? "KP-1" : null,
  matchedName: null,
  candidates: [],
  notices: [],
  fields,
});

/** 2: 마스터 찾음, 3: 새 마스터, 4: 실패(수량) */
function loaded(): BulkState {
  return bulkReducer(initialBulkState, {
    type: "loaded",
    rows: [row(2), row(3), row(4, { salesQuantity: "0" })],
    results: [result(2, "MATCHED"), result(3, "NEW_MASTER"), result(4, "FAILED", { salesQuantity: "서버 사유" })],
  });
}

describe("bulkReducer", () => {
  it("읽으면 목록을 정하고, 마스터를 찾은 줄만 체크한다 (새 마스터·실패는 해제)", () => {
    const s = loaded();
    expect(s.lines.map((l) => [l.rowNo, l.group, l.selected])).toEqual([
      [2, "ok", true],
      [3, "ok", false],
      [4, "failed", false],
    ]);
    expect(summary(s.lines)).toEqual({ ok: 2, failed: 1, selected: 1, newMasters: 0 });
  });

  it("오류가 있는 줄은 체크가 막힌다", () => {
    const s = bulkReducer(loaded(), { type: "toggled", rowNo: 4 });
    expect(s.lines[2].selected).toBe(false);
    expect(canSelect(s.lines[2])).toBe(false);
  });

  it("칸을 고치면 그 칸의 서버 오류가 지워지고 형식 오류가 즉시 붙는다. 줄은 목록을 옮기지 않는다", () => {
    let s = bulkReducer(loaded(), { type: "edited", rowNo: 4, field: "salesQuantity", value: "abc", today: TODAY });
    expect(errorsOf(s.lines[2]).salesQuantity).toBe(listing.validation.salesQuantity);
    expect(s.lines[2].dirty).toBe(true);
    s = bulkReducer(s, { type: "edited", rowNo: 4, field: "salesQuantity", value: "5", today: TODAY });
    expect(errorsOf(s.lines[2])).toEqual({});
    expect(s.lines[2].group).toBe("failed");
  });

  it("체크한 줄을 고쳐 오류가 생기면 체크가 풀린다", () => {
    const s = bulkReducer(loaded(), { type: "edited", rowNo: 2, field: "salesUnitPrice", value: "-1", today: TODAY });
    expect(s.lines[0].selected).toBe(false);
  });

  it("다시 검사 중에는 체크할 수 없고, 결과가 오면 갱신되며 체크는 풀려 있다", () => {
    let s = bulkReducer(loaded(), { type: "checking", rowNo: 2 });
    expect(canSelect(s.lines[0])).toBe(false);
    s = bulkReducer(s, { type: "rechecked", results: [result(2, "NEW_MASTER")] });
    expect(s.lines[0].result.status).toBe("NEW_MASTER");
    expect(s.lines[0].checking).toBe(false);
    expect(s.lines[0].selected).toBe(false);
    s = bulkReducer(s, { type: "toggled", rowNo: 2 });
    expect(s.lines[0].selected).toBe(true);
  });

  it("후보를 고르면 prodId 와 상품 칸이 후보 값으로 채워진다", () => {
    const s = bulkReducer(loaded(), {
      type: "picked",
      rowNo: 3,
      candidate: { prodId: "KP-9", prodName: "스위치 C9300", prodBrand: "Cisco", prodClassNo: "CLS-1" },
    });
    expect(s.lines[1].fields).toMatchObject({ prodId: "KP-9", prodName: "스위치 C9300", prodClassNo: "CLS-1" });
    expect(toApiRow(s.lines[1]).prodId).toBe("KP-9");
  });

  it("전체 선택은 오류 없는 줄만 체크하고, 해제는 모두 푼다", () => {
    let s = bulkReducer(loaded(), { type: "selectAll", value: true });
    expect(s.lines.map((l) => l.selected)).toEqual([true, true, false]);
    expect(summary(s.lines).newMasters).toBe(1);
    s = bulkReducer(s, { type: "selectAll", value: false });
    expect(s.lines.every((l) => !l.selected)).toBe(true);
  });

  it("확정에 보내는 줄은 체크한 줄뿐이고 빈 칸은 null 이다", () => {
    const rows = selectedRows(loaded().lines);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rowNo: 2, prodId: null, prodClassNo: null });
  });

  it("등록된 줄은 사라지고 안 보낸 줄은 남는다. 등록 건수는 누적", () => {
    const s = bulkReducer(loaded(), { type: "committed", rowNos: [2] });
    expect(s.lines.map((l) => l.rowNo)).toEqual([3, 4]);
    expect(s.created).toBe(1);
  });
});
