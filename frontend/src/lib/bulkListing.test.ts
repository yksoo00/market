import { describe, expect, it } from "vitest";
import { listing } from "@/messages/listing";
import type { BulkResult, BulkRowApi } from "@/types/listingBulk";
import { attachedFiles, bulkReducer, canSelect, errorsOf, initialBulkState, isLocked, selectedRows, summary, toApiRow, type BulkState } from "./bulkListing";

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
  it("읽으면 마스터를 찾은 줄만 체크한다 (새 마스터·실패는 해제)", () => {
    const s = loaded();
    expect(s.lines.map((l) => [l.rowNo, l.selected])).toEqual([
      [2, true],
      [3, false],
      [4, false],
    ]);
    expect(summary(s.lines)).toEqual({ ok: 2, failed: 1, selected: 1, newMasters: 0, committed: 0 });
  });

  it("오류가 있는 줄은 체크가 막힌다", () => {
    const s = bulkReducer(loaded(), { type: "toggled", rowNo: 4 });
    expect(s.lines[2].selected).toBe(false);
    expect(canSelect(s.lines[2])).toBe(false);
  });

  it("칸을 고치면 그 칸의 서버 오류가 지워지고 형식 오류가 즉시 붙는다", () => {
    let s = bulkReducer(loaded(), { type: "edited", rowNo: 4, field: "salesQuantity", value: "abc", today: TODAY });
    expect(errorsOf(s.lines[2]).salesQuantity).toBe(listing.validation.salesQuantity);
    expect(s.lines[2].dirty).toBe(true);
    s = bulkReducer(s, { type: "edited", rowNo: 4, field: "salesQuantity", value: "5", today: TODAY });
    expect(errorsOf(s.lines[2])).toEqual({});
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

  it("마스터를 고른 줄은 상품 칸이 잠겨 고쳐지지 않고, 상품 칸이 아닌 칸은 고칠 수 있다", () => {
    let s = bulkReducer(loaded(), {
      type: "picked",
      rowNo: 3,
      candidate: { prodId: "KP-9", prodName: "스위치 C9300", prodBrand: "Cisco", prodClassNo: null },
    });
    expect(isLocked(s.lines[1])).toBe(true);
    s = bulkReducer(s, { type: "edited", rowNo: 3, field: "prodName", value: "다른 상품", today: TODAY });
    expect(s.lines[1].fields).toMatchObject({ prodId: "KP-9", prodName: "스위치 C9300" });
    s = bulkReducer(s, { type: "edited", rowNo: 3, field: "salesQuantity", value: "9", today: TODAY });
    expect(s.lines[1].fields.salesQuantity).toBe("9");
  });

  it("마스터를 고르면 잠기는 칸의 입력 오류가 같이 지워진다 (잠긴 칸의 오류는 고칠 길이 없다)", () => {
    let s = bulkReducer(loaded(), { type: "edited", rowNo: 3, field: "prodNo", value: "x".repeat(21), today: TODAY });
    expect(errorsOf(s.lines[1]).prodNo).toBeDefined();
    s = bulkReducer(s, {
      type: "picked",
      rowNo: 3,
      candidate: { prodId: "KP-9", prodName: "스위치 C9300", prodBrand: "Cisco", prodClassNo: null, prodNo: "N-1", categoryCode: "P01-Q01-R001" },
    });
    expect(errorsOf(s.lines[1]).prodNo).toBeUndefined();
    expect(s.lines[1].fields).toMatchObject({ prodNo: "N-1", categoryCode: "P01-Q01-R001" });
  });

  it("[직접 입력으로 바꾸기]: prodId 만 비고 상품 칸은 마스터 값이 남은 채 편집할 수 있다", () => {
    let s = bulkReducer(loaded(), {
      type: "picked",
      rowNo: 3,
      candidate: { prodId: "KP-9", prodName: "스위치 C9300", prodBrand: "Cisco", prodClassNo: "CLS-1" },
    });
    s = bulkReducer(s, { type: "unlocked", rowNo: 3 });
    expect(isLocked(s.lines[1])).toBe(false);
    expect(s.lines[1].fields).toMatchObject({ prodId: "", prodName: "스위치 C9300", prodClassNo: "CLS-1" });
    s = bulkReducer(s, { type: "edited", rowNo: 3, field: "prodName", value: "다른 상품", today: TODAY });
    expect(toApiRow(s.lines[1])).toMatchObject({ prodId: null, prodName: "다른 상품" });
  });

  it("엑셀에 상품 ID 가 있던 줄도 잠겨 있다", () => {
    const s = bulkReducer(initialBulkState, { type: "loaded", rows: [row(2, { prodId: "KP-1" })], results: [result(2, "MATCHED")] });
    expect(isLocked(s.lines[0])).toBe(true);
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

  it("등록된 줄은 지워지지 않고 등록됨으로 남는다. 등록 건수는 누적, 요약에서는 빠진다", () => {
    const s = bulkReducer(loaded(), { type: "committed", rowNos: [2] });
    expect(s.lines.map((l) => [l.rowNo, l.committed])).toEqual([
      [2, true],
      [3, false],
      [4, false],
    ]);
    expect(s.lines[0].selected).toBe(false);
    expect(s.created).toBe(1);
    expect(summary(s.lines)).toEqual({ ok: 1, failed: 1, selected: 0, newMasters: 0, committed: 1 });
  });

  it("등록된 줄은 고치기·체크·재검사·다시 확정이 막힌다", () => {
    let s = bulkReducer(loaded(), { type: "committed", rowNos: [2] });
    s = bulkReducer(s, { type: "edited", rowNo: 2, field: "salesQuantity", value: "9", today: TODAY });
    s = bulkReducer(s, { type: "toggled", rowNo: 2 });
    s = bulkReducer(s, { type: "checking", rowNo: 2 });
    s = bulkReducer(s, { type: "rechecked", results: [result(2, "FAILED", { prodName: "x" })] });
    s = bulkReducer(s, { type: "selectAll", value: true });
    expect(s.lines[0]).toMatchObject({ committed: true, selected: false, checking: false });
    expect(s.lines[0].fields.salesQuantity).toBe("3");
    expect(s.lines[0].result.status).toBe("MATCHED");
    expect(canSelect(s.lines[0])).toBe(false);
    expect(selectedRows(s.lines).map((r) => r.rowNo)).not.toContain(2);
  });

  it("보이는 줄만 선택한다: selectVisible 은 넘긴 줄만 바꾸고 오류 있는 줄은 선택하지 않는다", () => {
    let s = bulkReducer(loaded(), { type: "selectAll", value: false });
    s = bulkReducer(s, { type: "selectVisible", rowNos: [3, 4], value: true });
    expect(s.lines.map((l) => [l.rowNo, l.selected])).toEqual([
      [2, false], // 숨겨진 줄은 그대로
      [3, true],
      [4, false], // 오류 있는 줄은 선택 불가
    ]);
    s = bulkReducer(s, { type: "selectVisible", rowNos: [3], value: false });
    expect(s.lines[1].selected).toBe(false);
  });
});

describe("ZIP 첨부 칸", () => {
  const photo = { name: "a.jpg", key: "public/listings/photos/2026/11/x.jpg", problem: null };

  it("읽을 때 서버가 준 첨부를 줄에 들고, 서버로 보낼 때 그대로 돌려 보낸다 (키를 잃지 않는다)", () => {
    const s = bulkReducer(initialBulkState, { type: "loaded", rows: [row(2, { photo1: photo })], results: [result(2, "MATCHED")] });

    expect(s.lines[0].files?.photo1).toEqual(photo);
    expect(toApiRow(s.lines[0]).photo1).toEqual(photo);
  });

  it("칸을 고쳐도 첨부는 그대로", () => {
    let s = bulkReducer(initialBulkState, { type: "loaded", rows: [row(2, { photo1: photo })], results: [result(2, "MATCHED")] });
    s = bulkReducer(s, { type: "edited", rowNo: 2, field: "description", value: "메모", today: TODAY });

    expect(toApiRow(s.lines[0]).photo1).toEqual(photo);
  });

  it("첨부 없는 옛 줄도 보낼 수 있다 (files 가 없으면 첨부 칸을 싣지 않는다)", () => {
    const s = bulkReducer(initialBulkState, { type: "loaded", rows: [row(2)], results: [result(2, "MATCHED")] });
    const old = { ...s.lines[0], files: undefined };

    expect(toApiRow(old)).not.toHaveProperty("photo1");
  });

  it("attachedFiles: 이름이 있는 칸만, 그 칸의 서버 오류와 함께", () => {
    const s = bulkReducer(initialBulkState, {
      type: "loaded",
      rows: [row(2, { photo1: photo, photo2: { name: "b.jpg", key: null, problem: "ZIP 안에서 찾을 수 없습니다." } })],
      results: [result(2, "FAILED", { photo2: "ZIP 안에서 찾을 수 없습니다." })],
    });

    expect(attachedFiles(s.lines[0])).toEqual([
      { slot: "photo1", name: "a.jpg", error: null },
      { slot: "photo2", name: "b.jpg", error: "ZIP 안에서 찾을 수 없습니다." },
    ]);
  });
});
