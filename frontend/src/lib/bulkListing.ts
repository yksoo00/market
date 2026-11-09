import { validateBulkRow, type BulkFields } from "@/lib/validation/bulkListing";
import type { BulkCandidate, BulkResult, BulkRowApi } from "@/types/listingBulk";

// 엑셀 다량 등록의 표 상태 (계획 2026-11-05-bulk-listing-excel.md, 2026-11-06-bulk-listing-page.md).
// 서버는 줄 상태를 저장하지 않아 수정·체크는 전부 여기(브라우저)에 있고, 검사·확정 때마다 서버로 다시 보낸다.

export interface BulkLine {
  rowNo: number;
  fields: BulkFields;
  /** 서버의 마지막 검사 결과. 아직 없으면(방금 수정해 다시 검사 중 포함) 이전 값을 유지한다 */
  result: BulkResult;
  /** 처음 읽었을 때의 검사 결과로 정한 목록. 줄은 고쳐도 목록을 옮겨 다니지 않는다 (위아래로 튀면 오입력이 늘어서) */
  group: "ok" | "failed";
  selected: boolean;
  /** 서버에 다시 물어보는 중 — 체크할 수 없다 */
  checking: boolean;
  /** 입력하는 동안 바로 보여 주는 형식·범위 오류 (zod). 서버 오류와 따로 둔다 */
  clientErrors: Record<string, string>;
  dirty: boolean;
  /** 이미 등록된 줄 — 화면에 남기되 수정·체크·재검사·재확정을 막는다 (등록한 것을 다시 확인할 수 있게) */
  committed: boolean;
}

export interface BulkState {
  lines: BulkLine[];
  /** 이번 작업에서 등록된 건수 */
  created: number;
}

export type BulkAction =
  | { type: "loaded"; rows: BulkRowApi[]; results: BulkResult[] }
  | { type: "edited"; rowNo: number; field: keyof BulkFields; value: string; today: string }
  | { type: "checking"; rowNo: number }
  | { type: "rechecked"; results: BulkResult[] }
  | { type: "toggled"; rowNo: number }
  | { type: "selectAll"; value: boolean }
  /** 지금 보이는 줄(필터·검색 적용)만 선택·해제 — 숨은 줄은 건드리지 않는다 */
  | { type: "selectVisible"; rowNos: number[]; value: boolean }
  | { type: "picked"; rowNo: number; candidate: BulkCandidate }
  /** 마스터를 고른 줄을 직접 입력으로 바꾼다 (상품 칸은 마스터 값을 그대로 둔 채 편집할 수 있게 된다) */
  | { type: "unlocked"; rowNo: number }
  | { type: "committed"; rowNos: number[] };

/** 마스터를 고르면 잠기는 칸 — 마스터 값이 기준이라 직접 고치지 않는다 (등록 폼과 같은 방식) */
export const LOCKED_FIELDS: (keyof BulkFields)[] = ["prodName", "prodBrand", "prodClassNo", "prodNo", "categoryCode"];

/** 마스터를 고른 줄(후보·[상품 찾기]·엑셀의 상품 ID)이면 상품 칸이 잠긴다 */
export const isLocked = (line: BulkLine): boolean => line.fields.prodId !== "";

export const initialBulkState: BulkState = { lines: [], created: 0 };

/** 서버가 준 줄(null 허용)을 화면 입력값(빈 칸 = "")으로 */
export function toFields(row: BulkRowApi): BulkFields {
  return {
    prodId: row.prodId ?? "",
    prodName: row.prodName ?? "",
    prodBrand: row.prodBrand ?? "",
    prodClassNo: row.prodClassNo ?? "",
    prodNo: row.prodNo ?? "",
    categoryCode: row.categoryCode ?? "",
    prodState: row.prodState ?? "",
    salesUnitPrice: row.salesUnitPrice ?? "",
    salesQuantity: row.salesQuantity ?? "",
    minOrderQuantity: row.minOrderQuantity ?? "",
    orderUnit: row.orderUnit ?? "",
    deliveryDate: row.deliveryDate ?? "",
    description: row.description ?? "",
  };
}

/** 서버로 보낼 줄. 빈 칸은 null (서버가 공백도 빈 칸으로 본다) */
export function toApiRow(line: BulkLine): BulkRowApi {
  const f = line.fields;
  const n = (s: string) => (s.trim() === "" ? null : s);
  return {
    rowNo: line.rowNo,
    prodId: n(f.prodId),
    prodName: n(f.prodName),
    prodBrand: n(f.prodBrand),
    prodClassNo: n(f.prodClassNo),
    prodNo: n(f.prodNo),
    categoryCode: n(f.categoryCode),
    prodState: n(f.prodState),
    salesUnitPrice: n(f.salesUnitPrice),
    salesQuantity: n(f.salesQuantity),
    minOrderQuantity: n(f.minOrderQuantity),
    orderUnit: n(f.orderUnit),
    deliveryDate: n(f.deliveryDate),
    description: n(f.description),
  };
}

/** 지금 이 줄의 칸별 오류 = 서버 사유 + 입력 중 형식 오류 (같은 칸이면 입력 중 오류가 앞선다) */
export function errorsOf(line: BulkLine): Record<string, string> {
  return { ...line.result.fields, ...line.clientErrors };
}

export const hasErrors = (line: BulkLine): boolean => Object.keys(errorsOf(line)).length > 0;

/** 등록되지 않았고, 오류가 없고, 서버에 물어보는 중이 아니면 체크할 수 있다 */
export const canSelect = (line: BulkLine): boolean => !line.committed && !line.checking && !hasErrors(line);

/** 등록된 줄은 세지 않는다 — 요약은 아직 남은 일 */
export function summary(lines: BulkLine[]): { ok: number; failed: number; selected: number; newMasters: number; committed: number } {
  const open = lines.filter((l) => !l.committed);
  const selected = open.filter((l) => l.selected);
  return {
    ok: open.filter((l) => !hasErrors(l)).length,
    failed: open.filter(hasErrors).length,
    selected: selected.length,
    newMasters: selected.filter((l) => l.result.status === "NEW_MASTER").length,
    committed: lines.length - open.length,
  };
}

/** 확정에 보낼 줄 = 체크한 줄 */
export const selectedRows = (lines: BulkLine[]): BulkRowApi[] => lines.filter((l) => l.selected && !l.committed).map(toApiRow);

/** 등록된 줄은 바꾸지 않는다 */
const patch = (state: BulkState, rowNo: number, change: (l: BulkLine) => BulkLine): BulkState => ({
  ...state,
  lines: state.lines.map((l) => (l.rowNo === rowNo && !l.committed ? change(l) : l)),
});

/** 서버 오류는 고친 칸의 것만 지운다. 다시 검사한 결과가 오면 새로 채워진다 */
const withoutError = (result: BulkResult, field: string): BulkResult => {
  const fields = { ...result.fields };
  delete fields[field];
  return { ...result, fields };
};

const withoutKeys = (record: Record<string, string>, keys: string[]): Record<string, string> =>
  Object.fromEntries(Object.entries(record).filter(([k]) => !keys.includes(k)));

export function bulkReducer(state: BulkState, action: BulkAction): BulkState {
  switch (action.type) {
    case "loaded": {
      const byRow = new Map(action.results.map((r) => [r.rowNo, r]));
      const lines: BulkLine[] = [];
      for (const row of action.rows) {
        const result = byRow.get(row.rowNo);
        if (!result) continue;
        lines.push({
          rowNo: row.rowNo,
          fields: toFields(row),
          result,
          group: result.status === "FAILED" ? "failed" : "ok",
          // 마스터를 찾은 줄만 처음부터 체크. 새 마스터는 사용자가 일부러 체크해야 한다
          selected: result.status === "MATCHED",
          checking: false,
          clientErrors: {},
          dirty: false,
          committed: false,
        });
      }
      return { lines, created: 0 };
    }
    case "edited":
      return patch(state, action.rowNo, (l) => {
        // 마스터를 고른 줄의 상품 칸은 잠겨 있다 — 고치려면 먼저 [직접 입력으로 바꾸기]
        if (isLocked(l) && LOCKED_FIELDS.includes(action.field)) return l;
        const fields = { ...l.fields, [action.field]: action.value };
        const clientErrors = validateBulkRow(fields, action.today);
        const next: BulkLine = { ...l, fields, clientErrors, dirty: true, result: withoutError(l.result, action.field) };
        return { ...next, selected: next.selected && !hasErrors(next) };
      });
    case "checking":
      return patch(state, action.rowNo, (l) => ({ ...l, checking: true, selected: false }));
    case "rechecked": {
      const byRow = new Map(action.results.map((r) => [r.rowNo, r]));
      return {
        ...state,
        lines: state.lines.map((l) => {
          const result = byRow.get(l.rowNo);
          if (!result || l.committed) return l;
          // 다시 검사한 줄은 체크를 풀어 둔다 — 고친 결과를 사용자가 눈으로 보고 다시 체크하게 (특히 새 마스터로 바뀐 줄)
          return { ...l, result, checking: false, selected: false };
        }),
      };
    }
    case "toggled":
      return patch(state, action.rowNo, (l) => (canSelect(l) ? { ...l, selected: !l.selected } : l));
    case "selectAll":
      return { ...state, lines: state.lines.map((l) => ({ ...l, selected: action.value && canSelect(l) })) };
    case "selectVisible": {
      const visible = new Set(action.rowNos);
      return { ...state, lines: state.lines.map((l) => (visible.has(l.rowNo) ? { ...l, selected: action.value && canSelect(l) } : l)) };
    }
    case "picked":
      return patch(state, action.rowNo, (l) => ({
        ...l,
        dirty: true,
        // 고른 마스터가 기준이라 상품 칸을 마스터 값으로 맞추고 잠근다. 상품 칸 오류는 다시 검사할 때 새로 정해진다
        fields: {
          ...l.fields,
          prodId: action.candidate.prodId,
          prodName: action.candidate.prodName,
          prodBrand: action.candidate.prodBrand,
          prodClassNo: action.candidate.prodClassNo ?? "",
        },
        result: { ...l.result, fields: withoutKeys(l.result.fields, ["prodId", "prodName", "prodBrand", "categoryCode"]) },
        clientErrors: withoutKeys(l.clientErrors, ["prodName", "prodBrand"]),
      }));
    case "unlocked":
      // prodId 만 비운다 — 상품 칸은 마스터 값이 그대로 남아 편집할 수 있고, 서버는 이 값으로 다시 마스터를 찾는다
      return patch(state, action.rowNo, (l) => ({
        ...l,
        dirty: true,
        fields: { ...l.fields, prodId: "" },
        result: { ...l.result, fields: withoutKeys(l.result.fields, ["prodId"]) },
      }));
    case "committed": {
      const done = new Set(action.rowNos);
      // 줄은 지우지 않고 등록됨으로 표시한다
      return {
        lines: state.lines.map((l) => (done.has(l.rowNo) ? { ...l, committed: true, selected: false, checking: false } : l)),
        created: state.created + action.rowNos.length,
      };
    }
  }
}
