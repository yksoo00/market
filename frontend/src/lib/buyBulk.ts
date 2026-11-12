import { PROD_STATES } from "@/lib/validation/listing";
import { BUY_CONDITION_FIELDS, validateBuyRow, type BuyFields } from "@/lib/validation/buyBulk";
import { buyBulk } from "@/messages/buyBulk";
import type { BuyCandidate, BuySort, CartBulkOutcome, CartBulkResult, CartBulkRowApi, ListingOption } from "@/types/cartBulk";

// 엑셀 대량구매의 표 상태 (계획 2026-11-09-bulk-purchase-excel.md). 판매 다량 등록(lib/bulkListing)과 같은 틀이지만 줄의 칸이 달라
// 구매 전용으로 따로 둔다. 서버는 줄 상태를 저장하지 않아 수정·체크는 전부 여기(브라우저)에 있고, 검사·담기 때마다 서버로 다시 보낸다.

export interface BuyLine {
  rowNo: number;
  fields: BuyFields;
  /** 서버의 마지막 검사 결과 (방금 수정해 다시 검사 중이면 이전 값을 유지한다) */
  result: CartBulkResult;
  selected: boolean;
  /** 서버에 다시 물어보는 중 — 체크할 수 없다 */
  checking: boolean;
  /** 입력하는 동안 바로 보여 주는 형식·범위 오류 (zod). 서버 오류와 따로 둔다 */
  clientErrors: Record<string, string>;
  dirty: boolean;
  /** 이미 장바구니에 담은 줄 — 화면에 남기되 수정·체크·재검사·재담기를 막는다 */
  added: boolean;
  /** 담기에 실패한 사유(그 줄에 보임). 다음에 고치거나 다시 검사하면 지워진다 */
  addError: string | null;
  /** 같은 상품이 앞 줄에도 있다 — 화면이 줄 전체를 보고 정한다(markDuplicates). 한 줄만 다시 검사하면 서버가 다른 줄을 못 보기 때문 */
  duplicate: boolean;
}

export interface BuyState {
  lines: BuyLine[];
  /** 이번 작업에서 담은 줄 수 */
  added: number;
  /** 서버가 알려 준 지금 장바구니 줄 수·한도 */
  cartCount: number;
  cartMax: number;
  /** 조건을 통과한 매물 중 기본으로 고르는 기준 — 모든 줄·검사·담기에 같은 값을 보낸다 */
  sort: BuySort;
}

/** 줄에서 마스터를 고를 때 넘기는 값 (후보 버튼·[상품 찾기]) */
export type BuyPick = BuyCandidate;

export type BuyAction =
  | { type: "loaded"; rows: CartBulkRowApi[]; results: CartBulkResult[]; cartCount: number; cartMax: number }
  | { type: "restored"; state: BuyState }
  | { type: "edited"; rowNo: number; field: keyof BuyFields; value: string; today: string }
  | { type: "checking"; rowNo: number }
  | { type: "rechecked"; results: CartBulkResult[]; cartCount?: number }
  | { type: "toggled"; rowNo: number }
  /** 지금 보이는 줄(필터·검색 적용)만 선택·해제 — 숨은 줄은 건드리지 않는다 */
  | { type: "selectVisible"; rowNos: number[]; value: boolean }
  | { type: "picked"; rowNo: number; pick: BuyPick }
  /** 마스터를 고른 줄을 직접 입력으로 바꾼다 (상품 칸은 마스터 값을 그대로 둔 채 편집할 수 있게 된다) */
  | { type: "unlocked"; rowNo: number }
  /** 다른 매물(또는 대체품 매물)을 고른다 */
  | { type: "chose"; rowNo: number; sellerId: string; regDate: string }
  | { type: "committed"; outcomes: CartBulkOutcome[]; cartCount: number }
  /** 기본 매물을 고르는 기준을 바꾼다 — 화면이 열린 줄 전부를 새 기준으로 다시 검사한다 */
  | { type: "sorted"; sort: BuySort };

/** 마스터를 고르면 잠기는 칸 — 마스터 값이 기준이라 직접 고치지 않는다 (판매 다량 등록·등록 폼과 같은 방식) */
export const LOCKED_FIELDS: (keyof BuyFields)[] = ["prodName", "prodBrand", "prodClassNo"];

/** 마스터를 고른 줄(후보·[상품 찾기]·엑셀의 상품 ID)이면 상품 칸이 잠긴다 */
export const isLocked = (line: BuyLine): boolean => line.fields.prodId !== "";

export const DEFAULT_SORT: BuySort = "price";

export const initialBuyState: BuyState = { lines: [], added: 0, cartCount: 0, cartMax: 100, sort: DEFAULT_SORT };

/** 서버가 준 줄(null 허용)을 화면 입력값(빈 칸 = "")으로 */
export function toFields(row: CartBulkRowApi): BuyFields {
  return {
    prodId: row.prodId ?? "",
    prodName: row.prodName ?? "",
    prodBrand: row.prodBrand ?? "",
    prodClassNo: row.prodClassNo ?? "",
    orderQuantity: row.orderQuantity ?? "",
    reqDeliDate: row.reqDeliDate ?? "",
    remarks: row.remarks ?? "",
    sellerId: row.sellerId ?? "",
    regDate: row.regDate ?? "",
    // 드롭다운 값과 맞춘다 — 서버는 겹공백·"12개월"도 받아 주지만 그대로 두면 선택 칸에 안 보이고 입력 검사에 걸린다
    minState: (row.minState ?? "").trim().replace(/\s+/g, " "),
    maxPrice: row.maxPrice ?? "",
    minWarrantyMonths: (row.minWarrantyMonths ?? "").trim().replace(/\s*개월$/, ""),
    needDataSheet: row.needDataSheet ?? "",
    needPhoto: row.needPhoto ?? "",
    needCoverage: row.needCoverage ?? "",
    needTestReport: row.needTestReport ?? "",
    needCertificate: row.needCertificate ?? "",
  };
}

const n = (s: string) => (s.trim() === "" ? null : s);

/**
 * 검사에 보낼 줄 — 사용자가 직접 고른 매물만 담는다. 안 골랐으면 서버가 (바뀐 수량에 맞게) 기본 매물을 다시 정한다
 */
export function toCheckRow(line: BuyLine): CartBulkRowApi {
  const f = line.fields;
  return {
    rowNo: line.rowNo,
    prodId: n(f.prodId),
    prodName: n(f.prodName),
    prodBrand: n(f.prodBrand),
    prodClassNo: n(f.prodClassNo),
    orderQuantity: n(f.orderQuantity),
    reqDeliDate: n(f.reqDeliDate),
    remarks: n(f.remarks),
    sellerId: n(f.sellerId),
    regDate: n(f.regDate),
    minState: n(f.minState),
    maxPrice: n(f.maxPrice),
    minWarrantyMonths: n(f.minWarrantyMonths),
    needDataSheet: n(f.needDataSheet),
    needPhoto: n(f.needPhoto),
    needCoverage: n(f.needCoverage),
    needTestReport: n(f.needTestReport),
    needCertificate: n(f.needCertificate),
  };
}

/**
 * 담기에 보낼 줄 — 화면에 보인 매물을 명시한다(보인 것과 담기는 것이 같도록). 그 사이 못 사게 됐으면 서버가 다른 매물로 바꾸지 않고
 * 그 줄을 실패로 돌려준다
 */
export function toCommitRow(line: BuyLine): CartBulkRowApi {
  const row = toCheckRow(line);
  const chosen = line.result.chosen;
  return chosen ? { ...row, sellerId: chosen.sellerId, regDate: chosen.regDate } : row;
}

/** 지금 이 줄의 칸별 오류 = 서버 사유 + 입력 중 형식 오류 (같은 칸이면 입력 중 오류가 앞선다) + 파일 안 중복 */
export function errorsOf(line: BuyLine): Record<string, string> {
  const errors = { ...line.result.fields, ...line.clientErrors };
  if (line.duplicate && !errors.prodName) errors.prodName = buyBulk.duplicate;
  return errors;
}

/** 서버가 파일 안 중복으로 단 오류는 지운다 — 화면이 줄 전체를 보고 다시 정하므로(markDuplicates) 낡은 중복 오류가 남지 않게 */
const withoutDuplicate = (result: CartBulkResult): CartBulkResult => {
  const fields = Object.fromEntries(Object.entries(result.fields).filter(([, message]) => message !== buyBulk.duplicate));
  return Object.keys(fields).length === Object.keys(result.fields).length ? result : { ...result, fields };
};

/**
 * 같은 상품(해석된 마스터)이 앞 줄에도 있으면 그 줄을 중복으로 표시한다. 담지 않은 줄만 행 번호 순으로 본다.
 * 서버(checkAll)도 같은 기준이지만, 줄 하나만 다시 검사하면 서버가 다른 줄을 못 봐서 화면이 이 기준을 이어 간다. 담기 때는 서버가 전부 다시 본다
 */
export function markDuplicates(state: BuyState): BuyState {
  const seen = new Set<string>();
  const open = [...state.lines].filter((l) => !l.added).sort((a, b) => a.rowNo - b.rowNo);
  const duplicateRows = new Set<number>();
  for (const l of open) {
    const key = l.result.prodId;
    if (key === null) continue;
    if (seen.has(key)) duplicateRows.add(l.rowNo);
    else seen.add(key);
  }
  return { ...state, lines: state.lines.map((l) => (l.duplicate === duplicateRows.has(l.rowNo) ? l : { ...l, duplicate: duplicateRows.has(l.rowNo) })) };
}

/** 살 수 있지만(하드 막힘 없음) 조건과 다른 점이 있는 매물 — 기본으로는 안 뽑히고 사용자가 직접 고른다 */
export const mismatchedOptions = (result: CartBulkResult): ListingOption[] => result.options.filter((o) => o.reason === null && o.mismatches.length > 0);

/** 살 수 있고 조건과 다른 점도 없는 매물 (서버 CartBulkService.clean 과 같은 정의 — 바꾸면 함께) */
export const isClean = (o: ListingOption): boolean => o.reason === null && o.mismatches.length === 0;

/** 서버 CartBulkConditions.comparator 와 같은 순서 — 페이지의 "매물 고르는 기준"을 줄에 보이는 목록에도 적용한다 */
export function compareOptions(sort: BuySort): (a: ListingOption, b: ListingOption) => number {
  const state = (o: ListingOption) => {
    const i = (PROD_STATES as readonly string[]).indexOf((o.traits.prodState ?? "").trim());
    return i < 0 ? 99 : i;
  };
  const warranty = (o: ListingOption) => o.traits.warrantyDays ?? -1;
  return (a, b) => {
    const price = a.unitPrice - b.unitPrice;
    const longer = warranty(b) - warranty(a);
    const better = state(a) - state(b);
    const lead = sort === "price" ? [price, longer, better] : sort === "state" ? [better, price, longer] : [longer, price, better];
    // 같으면 제공가능일 빠른 것 → 재고 많은 것 → 등록일시 빠른 것 (서버와 같다)
    const tail = (a.deliveryDate ?? "~").localeCompare(b.deliveryDate ?? "~") || b.stock - a.stock || a.regDate.localeCompare(b.regDate);
    return lead.find((d) => d !== 0) ?? tail;
  };
}

/** 매물 없음 줄에 바로 보일 못 사는 이유 — 같은 문구는 한 번만, 앞에서 max 개. 전부는 [다른 매물 보기]에 있다 */
export const blockedReasons = (result: CartBulkResult, max = 3): string[] => [...new Set(result.options.flatMap((o) => o.reason ?? []))].slice(0, max);

export const hasErrors = (line: BuyLine): boolean => Object.keys(errorsOf(line)).length > 0;

/** 담지 않았고, 오류(파일 안 중복 포함)가 없고, 살 매물이 골라져 있고, 서버에 물어보는 중이 아니면 체크할 수 있다 */
export const canSelect = (line: BuyLine): boolean =>
  !line.added && !line.checking && !hasErrors(line) && line.result.status === "AVAILABLE" && line.result.chosen !== null;

/** 담은 줄은 세지 않는다 — 요약은 아직 남은 일 */
export function summary(lines: BuyLine[]): { available: number; unavailable: number; failed: number; selected: number; added: number } {
  const open = lines.filter((l) => !l.added);
  return {
    available: open.filter((l) => !hasErrors(l) && l.result.status === "AVAILABLE").length,
    unavailable: open.filter((l) => !hasErrors(l) && l.result.status === "UNAVAILABLE").length,
    failed: open.filter(hasErrors).length,
    selected: open.filter((l) => l.selected).length,
    added: lines.length - open.length,
  };
}

/** 담지 않은 줄만 바꾼다 */
const patch = (state: BuyState, rowNo: number, change: (l: BuyLine) => BuyLine): BuyState => ({
  ...state,
  lines: state.lines.map((l) => (l.rowNo === rowNo && !l.added ? change(l) : l)),
});

/** 서버 오류는 고친 칸의 것만 지운다. 다시 검사한 결과가 오면 새로 채워진다 */
const withoutError = (result: CartBulkResult, field: string): CartBulkResult => {
  const fields = { ...result.fields };
  delete fields[field];
  return { ...result, fields };
};

const withoutKeys = (record: Record<string, string>, keys: string[]): Record<string, string> =>
  Object.fromEntries(Object.entries(record).filter(([k]) => !keys.includes(k)));

export function buyReducer(state: BuyState, action: BuyAction): BuyState {
  return markDuplicates(reduce(state, action));
}

function reduce(state: BuyState, action: BuyAction): BuyState {
  switch (action.type) {
    case "loaded": {
      const byRow = new Map(action.results.map((r) => [r.rowNo, r]));
      const lines: BuyLine[] = [];
      for (const row of action.rows) {
        const result = byRow.get(row.rowNo);
        if (!result) continue;
        lines.push({
          rowNo: row.rowNo,
          fields: toFields(row),
          result: withoutDuplicate(result),
          // 살 매물이 골라진 줄만 처음부터 체크. 매물 없음·오류는 체크할 수 없다
          selected: result.status === "AVAILABLE" && result.chosen !== null,
          checking: false,
          clientErrors: {},
          dirty: false,
          added: false,
          addError: null,
          duplicate: false,
        });
      }
      return { lines, added: 0, cartCount: action.cartCount, cartMax: action.cartMax, sort: state.sort };
    }
    case "restored":
      return action.state;
    case "edited":
      return patch(state, action.rowNo, (l) => {
        // 마스터를 고른 줄의 상품 칸은 잠겨 있다 — 고치려면 먼저 [직접 입력으로 바꾸기]
        if (isLocked(l) && LOCKED_FIELDS.includes(action.field)) return l;
        const fields = { ...l.fields, [action.field]: action.value };
        // 상품이 바뀌면 전에 고른 매물은 더 맞지 않는다. 조건을 바꿔도 조건이 곧 기본 매물을 정하는 기준이라 직접 고른 매물을 비우고 서버가 다시 정하게 한다.
        // 수량·납품희망일·요청사항을 고칠 땐 고른 매물을 그대로 두고 서버가 다시 판정한다
        const changesPick =
          action.field === "prodName" || action.field === "prodBrand" || action.field === "prodClassNo" || (BUY_CONDITION_FIELDS as readonly string[]).includes(action.field);
        if (changesPick) {
          fields.sellerId = "";
          fields.regDate = "";
        }
        const clientErrors = validateBuyRow(fields, action.today);
        const next: BuyLine = {
          ...l,
          fields,
          clientErrors,
          dirty: true,
          addError: null,
          // 고른 매물을 비웠으니 그 매물에 대한 서버 사유(listing)도 같이 지운다
          result: changesPick ? { ...l.result, fields: withoutKeys(l.result.fields, [action.field, "listing"]) } : withoutError(l.result, action.field),
        };
        return { ...next, selected: next.selected && !hasErrors(next) };
      });
    case "checking":
      return patch(state, action.rowNo, (l) => ({ ...l, checking: true, selected: false }));
    case "rechecked": {
      const byRow = new Map(action.results.map((r) => [r.rowNo, r]));
      return {
        ...state,
        cartCount: action.cartCount ?? state.cartCount,
        lines: state.lines.map((l) => {
          const result = byRow.get(l.rowNo);
          if (!result || l.added) return l;
          // 다시 검사한 줄은 체크를 풀어 둔다 — 바뀐 결과를 사용자가 눈으로 보고 다시 체크하게 (특히 고를 매물이 바뀐 줄)
          return { ...l, result: withoutDuplicate(result), checking: false, selected: false, addError: null };
        }),
      };
    }
    case "toggled":
      return patch(state, action.rowNo, (l) => (canSelect(l) ? { ...l, selected: !l.selected } : l));
    case "selectVisible": {
      const visible = new Set(action.rowNos);
      return { ...state, lines: state.lines.map((l) => (visible.has(l.rowNo) ? { ...l, selected: action.value && canSelect(l) } : l)) };
    }
    case "picked":
      return patch(state, action.rowNo, (l) => ({
        ...l,
        dirty: true,
        addError: null,
        // 다시 검사 결과가 오기 전엔 담을 수 없다 — 옛 마스터의 고른 매물이 새 상품과 같이 담기는 일을 막는다
        selected: false,
        // 고른 마스터가 기준이라 상품 칸을 마스터 값으로 맞추고 잠근다. 전에 고른 매물은 다른 상품의 것이라 비운다
        fields: {
          ...l.fields,
          prodId: action.pick.prodId,
          prodName: action.pick.prodName,
          prodBrand: action.pick.prodBrand,
          prodClassNo: action.pick.prodClassNo ?? "",
          sellerId: "",
          regDate: "",
        },
        result: { ...l.result, fields: withoutKeys(l.result.fields, ["prodId", "prodName", "prodBrand", "listing"]) },
        // 잠기는 칸의 입력 오류는 같이 지운다 — 남으면 잠긴 칸의 오류를 고칠 길이 없다
        clientErrors: withoutKeys(l.clientErrors, LOCKED_FIELDS),
      }));
    case "unlocked":
      // prodId 만 비운다 — 상품 칸은 마스터 값이 그대로 남아 편집할 수 있고, 서버는 이 값으로 다시 마스터를 찾는다
      return patch(state, action.rowNo, (l) => ({
        ...l,
        dirty: true,
        selected: false,
        fields: { ...l.fields, prodId: "", sellerId: "", regDate: "" },
        result: { ...l.result, fields: withoutKeys(l.result.fields, ["prodId", "listing"]) },
      }));
    case "chose":
      return patch(state, action.rowNo, (l) => ({
        ...l,
        dirty: true,
        addError: null,
        selected: false,
        fields: { ...l.fields, sellerId: action.sellerId, regDate: action.regDate },
        result: withoutError(l.result, "listing"),
      }));
    case "committed": {
      const byRow = new Map(action.outcomes.map((o) => [o.rowNo, o]));
      let addedNow = 0;
      const lines = state.lines.map((l) => {
        const outcome = byRow.get(l.rowNo);
        if (!outcome || l.added) return l;
        if (outcome.ok) {
          addedNow += 1;
          return { ...l, added: true, selected: false, checking: false, addError: null };
        }
        // 실패한 줄은 사유와 함께 남긴다. 체크는 풀어 같은 실패를 되풀이해 보내지 않게
        return { ...l, selected: false, addError: outcome.message ?? "담지 못했어요." };
      });
      return { ...state, lines, added: state.added + addedNow, cartCount: action.cartCount };
    }
    case "sorted":
      return { ...state, sort: action.sort };
  }
}
