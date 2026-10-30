import type { ReactNode } from "react";

// 검색창 + 필터 칩 줄의 화면 중립 정의 (계획 2026-10-30). 화면마다 칸 정의(FilterField)만 넘긴다 — 검색 결과·거래이력·활동내역이 같다.
// 값은 전부 문자열이고 빈 문자열 = 조건 없음. 키는 주소 파라미터 이름과 같다 (여러 값은 쉼표로 이은 문자열).

export type FilterValues = Record<string, string>;

/** 칩 하나가 모든 종류에서 같이 갖는 것 */
interface FieldBase {
  /** 칩 이름 (걸리지 않았을 때 칩에 보이는 글자이자 × 의 접근 가능한 이름) */
  label: string;
  /** 칩에 보이는 글자를 직접 정한다 (걸렸든 아니든). 없으면 종류별 기본 글자 */
  chipText?: (values: FilterValues) => string;
  /** 팝업 폭 클래스 (예: "w-[34rem]") */
  width?: string;
}

/** 팝업 안에서 한 번에 [적용]하는 묶음(group)의 칸 */
export type GroupItem =
  | { kind: "date"; key: string; label: string; suffix?: string }
  | { kind: "select"; key: string; label: string; options: { value: string; label: string }[] }
  | { kind: "text"; key: string; label: string; placeholder?: string }
  | { kind: "number"; key: string; label: string; suffix?: string }
  | { kind: "check"; key: string; label: string; options: { value: string; label: string }[] };

/** custom 칸의 팝업을 그릴 때 받는 것 */
export interface CustomContext {
  /** 지금 걸려 있는 값 (주소) */
  values: FilterValues;
  /** 팝업 안에서 고르는 중인 값 */
  draft: FilterValues;
  setDraft: (key: string, value: string) => void;
  /** 이 값으로 바로 적용하고 팝업을 닫는다 */
  applyNow: (next: FilterValues) => void;
}

export type FilterField =
  | (FieldBase & { kind: "dateRange"; fromKey: string; toKey: string; fromLabel: string; toLabel: string })
  | (FieldBase & { kind: "numberRange"; minKey: string; maxKey: string; minLabel: string; maxLabel: string; suffix: string })
  /** 숫자 하나 ("재고 N개 이상") */
  | (FieldBase & { kind: "numberMin"; key: string; suffix: string })
  /** 고르면 바로 적용되는 선택 */
  | (FieldBase & { kind: "select"; key: string; defaultValue: string; options: { value: string; label: string }[] })
  /** 여러 칸을 한 팝업에 모아 [적용] 한 번 (검색의 [상세 필터]) */
  | (FieldBase & { kind: "group"; items: GroupItem[] })
  /** 화면 전용 팝업 (검색의 카테고리 패널). 쓰는 값 키를 알려 주고 팝업 안은 그쪽이 그린다 */
  | (FieldBase & { kind: "custom"; keys: string[]; render: (ctx: CustomContext) => ReactNode });

/** 칸이 쓰는 값 키들 */
export function fieldKeys(field: FilterField): string[] {
  switch (field.kind) {
    case "dateRange":
      return [field.fromKey, field.toKey];
    case "numberRange":
      return [field.minKey, field.maxKey];
    case "numberMin":
    case "select":
      return [field.key];
    case "group":
      return field.items.map((i) => i.key);
    case "custom":
      return field.keys;
  }
}

/** 값이 "조건 없음" 상태인가 (select 는 기본값이면 없음) */
export function fieldIsEmpty(field: FilterField, values: FilterValues): boolean {
  if (field.kind === "select") return (values[field.key] ?? field.defaultValue) === field.defaultValue;
  return fieldKeys(field).every((k) => !values[k]);
}

/** group 에서 걸린 칸 수 ([상세 필터 N] 에 보인다) */
export function groupCount(field: FilterField & { kind: "group" }, values: FilterValues): number {
  return field.items.filter((i) => !!values[i.key]).length;
}

/** 걸린 칩 수. 기간·금액은 양끝 중 하나라도 있으면 1 */
export function filterCount(fields: FilterField[], values: FilterValues): number {
  return fields.filter((f) => !fieldIsEmpty(f, values)).length;
}

/** 값 → 주소 파라미터. 빈 값과 select 기본값은 뺀다 (같은 조건이 다른 주소가 되지 않게) */
export function filterParams(fields: FilterField[], values: FilterValues, searchKey: string): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  const q = (values[searchKey] ?? "").trim();
  if (q) out[searchKey] = q;
  for (const f of fields) {
    if (fieldIsEmpty(f, values)) continue;
    for (const k of fieldKeys(f)) if (values[k]) out[k] = values[k];
  }
  return out;
}

/** 주소의 첫 값 */
export function firstParam(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}
