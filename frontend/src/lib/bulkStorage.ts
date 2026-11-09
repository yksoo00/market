import type { BulkLine, BulkState } from "@/lib/bulkListing";

// 다량 등록 작업을 브라우저 sessionStorage 에 보관한다 (계획 2026-11-06-bulk-listing-page.md). 새로고침해도 고친 줄·체크를 잃지 않게.
// 서버에는 저장하지 않는다는 결정(2026-11-05)과 안 부딪힌다 — 이 탭의 브라우저 안에만 있고 탭을 닫으면 사라진다.
// 줄에는 상품·가격 정보뿐이고 개인정보(이메일·전화)가 없다. 보관에 실패해도(용량·차단) 작업은 계속된다.

/** 줄의 입력 칸 이름 전부 (BulkFields) */
const FIELD_KEYS = [
  "prodId",
  "prodName",
  "prodBrand",
  "prodClassNo",
  "prodNo",
  "categoryCode",
  "prodState",
  "salesUnitPrice",
  "salesQuantity",
  "minOrderQuantity",
  "orderUnit",
  "deliveryDate",
  "description",
] as const;

/** 보관 형식이 바뀌면 올린다 — 다른 버전의 보관본은 읽지 않고 버린다 */
const VERSION = 1;

export const BULK_STORAGE_KEY = "market.bulkListing.v1";

const browserStorage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null; // 저장소가 막힌 브라우저
  }
};

export function saveBulk(state: BulkState, storage: Storage | null = browserStorage()): void {
  if (!storage) return;
  try {
    // 줄이 하나도 없으면 보관할 것이 없다 — 빈 보관본을 남겨 이어서 보여 주는 일을 막는다
    if (state.lines.length === 0) {
      storage.removeItem(BULK_STORAGE_KEY);
      return;
    }
    storage.setItem(BULK_STORAGE_KEY, JSON.stringify({ version: VERSION, state }));
  } catch {
    // 용량 초과·차단 — 보관만 못 할 뿐 작업은 이어진다
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** 화면이 읽는 칸(fields 전부 글자, result 의 배열·객체)이 다 있어야 한다 — 하나라도 빠진 보관본을 받으면 화면이 매번 죽는다 */
const isLine = (v: unknown): v is BulkLine => {
  if (!isRecord(v) || !isRecord(v.fields) || !isRecord(v.result) || !isRecord(v.clientErrors)) return false;
  const result = v.result;
  return (
    typeof v.rowNo === "number" &&
    typeof v.selected === "boolean" &&
    typeof v.committed === "boolean" &&
    typeof v.checking === "boolean" &&
    typeof v.dirty === "boolean" &&
    FIELD_KEYS.every((k) => typeof (v.fields as Record<string, unknown>)[k] === "string") &&
    typeof result.rowNo === "number" &&
    ["MATCHED", "NEW_MASTER", "FAILED"].includes(String(result.status)) &&
    Array.isArray(result.candidates) &&
    Array.isArray(result.notices) &&
    isRecord(result.fields)
  );
};

/** 보관본이 없거나 못 읽으면(깨짐·다른 버전·모양 불일치) null 이고 보관본도 지운다 */
export function loadBulk(storage: Storage | null = browserStorage()): BulkState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(BULK_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    const state = (parsed as { version?: unknown; state?: Partial<BulkState> }).state;
    if ((parsed as { version?: unknown }).version !== VERSION || !state || !Array.isArray(state.lines) || !state.lines.every(isLine) || typeof state.created !== "number") {
      storage.removeItem(BULK_STORAGE_KEY);
      return null;
    }
    // 서버 응답을 기다리던 줄이 영영 "검사 중"으로 남지 않게 푼다
    return { lines: state.lines.map((l) => ({ ...l, checking: false })), created: state.created };
  } catch {
    try {
      storage.removeItem(BULK_STORAGE_KEY);
    } catch {
      // 지우기도 막힘
    }
    return null;
  }
}

export function clearBulk(storage: Storage | null = browserStorage()): void {
  try {
    storage?.removeItem(BULK_STORAGE_KEY);
  } catch {
    // 막힌 저장소
  }
}
