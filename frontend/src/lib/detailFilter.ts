// 검색창 + [상세] 필터 팝업의 화면 중립 정의 (계획 2026-10-30). 화면마다 칸 정의(FilterField)만 넘긴다.
// 값은 전부 문자열이고 빈 문자열 = 조건 없음. 키는 주소 파라미터 이름과 같다.

export type FilterValues = Record<string, string>;

export type FilterField =
  | { kind: "dateRange"; label: string; fromKey: string; toKey: string; fromLabel: string; toLabel: string }
  | { kind: "numberRange"; label: string; minKey: string; maxKey: string; minLabel: string; maxLabel: string; suffix: string }
  | { kind: "select"; label: string; key: string; defaultValue: string; options: { value: string; label: string }[] };

/** 칸이 쓰는 값 키들 */
export function fieldKeys(field: FilterField): string[] {
  switch (field.kind) {
    case "dateRange":
      return [field.fromKey, field.toKey];
    case "numberRange":
      return [field.minKey, field.maxKey];
    case "select":
      return [field.key];
  }
}

/** 값이 "조건 없음" 상태인가 (select 는 기본값이면 없음) */
export function fieldIsEmpty(field: FilterField, values: FilterValues): boolean {
  if (field.kind === "select") return (values[field.key] ?? field.defaultValue) === field.defaultValue;
  return fieldKeys(field).every((k) => !values[k]);
}

/** [상세] 버튼에 보이는 걸린 칸 수. 기간·금액은 양끝 중 하나라도 있으면 1 */
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
