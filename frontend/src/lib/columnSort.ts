// 열 머리 정렬 (사용자 지시 2026-11-03): 열 머리를 누를 때마다 오름 → 내림 → 기본(최신순) → 오름 … 으로 돈다.
// 주소의 sort 값 하나로 정렬 칩과 같이 움직인다. 표마다 "열 → 오름·내림 값"만 정해 이 함수들을 같이 쓴다

/** 한 열의 오름·내림 sort 값 (예: 단가 = priceAsc · priceDesc) */
export interface ColumnSortValues<T extends string = string> {
  asc: T;
  desc: T;
}

export type SortState = "asc" | "desc" | null;

/** 지금 sort 가 이 열의 정렬인가 — 오름·내림·아님. 기본값이 그 열의 내림(예: 등록일 = latest)이면 처음부터 내림으로 보인다 */
export function sortStateOf(current: string, values: ColumnSortValues): SortState {
  if (current === values.asc) return "asc";
  if (current === values.desc) return "desc";
  return null;
}

/**
 * 열 머리를 눌렀을 때의 다음 sort. 오름 → 내림 → 기본 → 오름.
 * 그 열의 내림이 기본값 자체인 열(등록일)은 기본값 = 내림이라 오름 ↔ 내림 두 단계로 돈다
 */
export function nextSort<T extends string>(current: string, values: ColumnSortValues<T>, defaultValue: T): T {
  if (current === values.asc) return values.desc;
  if (current === values.desc) return values.desc === defaultValue ? values.asc : defaultValue;
  return values.asc;
}
