import type { BuyLine, BuyState } from "@/lib/buyBulk";
import type { BuySort } from "@/types/cartBulk";

// 대량구매 작업을 브라우저 sessionStorage 에 보관한다 (계획 2026-11-09-bulk-purchase-excel.md). 새로고침해도 고친 줄·체크를 잃지 않게.
// 판매 다량 등록의 보관(lib/bulkStorage)과 같은 규칙: 서버에는 저장하지 않고, 탭을 닫으면 사라지며, 저장 실패는 조용히 넘기고,
// 모양이 어긋난 보관본은 버린다. 키가 한 개라 계정 구분이 없으므로 로그인·로그아웃 때 비운다(lib/api/auth.ts).

/** 줄의 입력 칸 이름 전부 (BuyFields) */
const FIELD_KEYS = [
  "prodId",
  "prodName",
  "prodBrand",
  "prodClassNo",
  "orderQuantity",
  "reqDeliDate",
  "remarks",
  "sellerId",
  "regDate",
  "minState",
  "maxPrice",
  "minWarrantyMonths",
  "needDataSheet",
  "needPhoto",
  "needCoverage",
  "needTestReport",
  "needCertificate",
] as const;

const SORTS = ["price", "state", "warranty"];

/** 보관 형식이 바뀌면 올린다 — 다른 버전의 보관본은 읽지 않고 버린다 */
const VERSION = 2;

export const BUY_STORAGE_KEY = "market.buyBulk.v2";

/** 조건 열이 생기기 전(v1)의 보관본 — 읽지 않고 지운다 */
const LEGACY_KEYS = ["market.buyBulk.v1"];

const browserStorage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null; // 저장소가 막힌 브라우저
  }
};

export function saveBuyBulk(state: BuyState, storage: Storage | null = browserStorage()): void {
  if (!storage) return;
  try {
    // 줄이 하나도 없으면 보관할 것이 없다 — 빈 보관본을 남겨 이어서 보여 주는 일을 막는다
    if (state.lines.length === 0) {
      storage.removeItem(BUY_STORAGE_KEY);
      return;
    }
    storage.setItem(BUY_STORAGE_KEY, JSON.stringify({ version: VERSION, state }));
  } catch {
    // 용량 초과·차단 — 보관만 못 할 뿐 작업은 이어진다
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** 화면이 읽는 칸(fields 전부 글자, result 의 배열·객체)이 다 있어야 한다 — 하나라도 빠진 보관본을 받으면 화면이 매번 죽는다 */
const isLine = (v: unknown): v is BuyLine => {
  if (!isRecord(v) || !isRecord(v.fields) || !isRecord(v.result) || !isRecord(v.clientErrors)) return false;
  const result = v.result;
  return (
    typeof v.rowNo === "number" &&
    typeof v.selected === "boolean" &&
    typeof v.added === "boolean" &&
    typeof v.checking === "boolean" &&
    typeof v.dirty === "boolean" &&
    (v.addError === null || typeof v.addError === "string") &&
    FIELD_KEYS.every((k) => typeof (v.fields as Record<string, unknown>)[k] === "string") &&
    typeof result.rowNo === "number" &&
    ["AVAILABLE", "UNAVAILABLE", "FAILED"].includes(String(result.status)) &&
    typeof result.substituted === "boolean" &&
    Array.isArray(result.options) &&
    // 후보 팝업이 매물 특성(traits)을 읽는다 — 빠진 보관본을 받으면 화면이 죽는다
    result.options.every((o) => isRecord(o) && isRecord(o.traits)) &&
    Array.isArray(result.alternatives) &&
    Array.isArray(result.candidates) &&
    Array.isArray(result.notices) &&
    isRecord(result.fields)
  );
};

/** 보관본이 없거나 못 읽으면(깨짐·다른 버전·모양 불일치) null 이고 보관본도 지운다 */
export function loadBuyBulk(storage: Storage | null = browserStorage()): BuyState | null {
  if (!storage) return null;
  try {
    LEGACY_KEYS.forEach((k) => storage.removeItem(k));
    const raw = storage.getItem(BUY_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    const state = (parsed as { state?: Partial<BuyState> }).state;
    if (
      (parsed as { version?: unknown }).version !== VERSION ||
      !state ||
      !Array.isArray(state.lines) ||
      !state.lines.every(isLine) ||
      typeof state.added !== "number" ||
      typeof state.cartCount !== "number" ||
      typeof state.cartMax !== "number" ||
      !SORTS.includes(String(state.sort))
    ) {
      storage.removeItem(BUY_STORAGE_KEY);
      return null;
    }
    // 서버 응답을 기다리던 줄이 영영 "검사 중"으로 남지 않게 푼다
    return {
      lines: state.lines.map((l) => ({ ...l, checking: false })),
      added: state.added,
      cartCount: state.cartCount,
      cartMax: state.cartMax,
      sort: state.sort as BuySort,
    };
  } catch {
    try {
      storage.removeItem(BUY_STORAGE_KEY);
    } catch {
      // 지우기도 막힘
    }
    return null;
  }
}

export function clearBuyBulk(storage: Storage | null = browserStorage()): void {
  try {
    storage?.removeItem(BUY_STORAGE_KEY);
    LEGACY_KEYS.forEach((k) => storage?.removeItem(k));
  } catch {
    // 막힌 저장소
  }
}
