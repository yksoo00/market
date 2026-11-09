import { hasErrors, type BulkLine } from "@/lib/bulkListing";

// 다량 등록 표의 필터·검색·정렬 (계획 2026-11-06-bulk-listing-page.md). 서버에는 줄이 없어 전부 브라우저에서 한다.
// 정렬은 열 머리를 누를 때만 다시 돌고, 칸을 고쳐도 줄 순서는 그대로다 (고칠 때마다 줄이 위아래로 튀면 오입력이 는다).

export type BulkTab = "all" | "ok" | "new" | "failed" | "done";

export type BulkSortKey = "rowNo" | "prodName" | "prodBrand" | "salesUnitPrice" | "salesQuantity" | "status";

export type BulkSort = { key: BulkSortKey; dir: "asc" | "desc" } | null;

export interface BulkView {
  tab: BulkTab;
  query: string;
  sort: BulkSort;
}

/** 처음엔 등록되지 않은 줄 전부, 정렬 없음(= 엑셀 행 번호 순) */
export const initialBulkView: BulkView = { tab: "all", query: "", sort: null };

/** 한 줄이 속하는 탭 (all 은 따로 — 등록됨을 뺀 전부). 오류가 있으면 새 상품이어도 확인 필요 */
export function tabOf(line: BulkLine): Exclude<BulkTab, "all"> {
  if (line.committed) return "done";
  if (hasErrors(line)) return "failed";
  return line.result.status === "NEW_MASTER" ? "new" : "ok";
}

export function tabCounts(lines: BulkLine[]): Record<BulkTab, number> {
  const counts: Record<BulkTab, number> = { all: 0, ok: 0, new: 0, failed: 0, done: 0 };
  for (const l of lines) {
    const tab = tabOf(l);
    counts[tab] += 1;
    if (tab !== "done") counts.all += 1;
  }
  return counts;
}

const matches = (line: BulkLine, query: string): boolean => {
  if (query === "") return true;
  const q = query.toLowerCase();
  return [line.fields.prodName, line.fields.prodBrand, line.result.matchedName ?? ""].some((s) => s.toLowerCase().includes(q));
};

/** 쉼표를 뗀 수. 숫자가 아니면 NaN — 정렬에서 맨 뒤로 */
const numberOf = (s: string): number => (/^-?\d+$/.test(s.replace(/,/g, "").trim()) ? Number(s.replace(/,/g, "").trim()) : Number.NaN);

/** 오름차순에서 오류 → 새 상품 → 마스터 찾음 (오류 먼저 보려는 정렬) */
const STATUS_ORDER: Record<Exclude<BulkTab, "all">, number> = { failed: 0, new: 1, ok: 2, done: 3 };

function compare(a: BulkLine, b: BulkLine, key: BulkSortKey): number {
  switch (key) {
    case "rowNo":
      return a.rowNo - b.rowNo;
    case "prodName":
      return a.fields.prodName.localeCompare(b.fields.prodName, "ko");
    case "prodBrand":
      return a.fields.prodBrand.localeCompare(b.fields.prodBrand, "ko");
    case "salesUnitPrice":
    case "salesQuantity": {
      const [x, y] = [numberOf(a.fields[key]), numberOf(b.fields[key])];
      return Number.isNaN(x) || Number.isNaN(y) ? 0 : x - y;
    }
    case "status":
      return STATUS_ORDER[tabOf(a)] - STATUS_ORDER[tabOf(b)];
  }
}

/** 정렬할 값이 없는 줄(숫자 칸에 글자) — 방향과 상관없이 맨 뒤로 보낸다 */
const isMissing = (line: BulkLine, key: BulkSortKey): boolean =>
  (key === "salesUnitPrice" || key === "salesQuantity") && Number.isNaN(numberOf(line.fields[key]));

/** 탭 → 검색 → 정렬 순으로 지금 보일 줄. 입력 배열은 바꾸지 않는다 */
export function visibleLines(lines: BulkLine[], view: BulkView): BulkLine[] {
  const query = view.query.trim();
  const shown = lines.filter((l) => (view.tab === "all" ? !l.committed : tabOf(l) === view.tab) && matches(l, query));
  const sort = view.sort ?? { key: "rowNo", dir: "asc" };
  const sign = sort.dir === "asc" ? 1 : -1;
  // 같으면 행 번호 순 — 정렬이 매번 같은 결과가 되게
  return [...shown].sort((a, b) => {
    const [missingA, missingB] = [isMissing(a, sort.key), isMissing(b, sort.key)];
    if (missingA !== missingB) return missingA ? 1 : -1;
    return sign * compare(a, b, sort.key) || a.rowNo - b.rowNo;
  });
}

/** 열 머리를 눌렀을 때의 다음 정렬. 오름 → 내림 → 해제 (기존 열 머리 정렬 lib/columnSort 와 같은 순서) */
export function nextSortFor(view: BulkView, key: BulkSortKey): BulkSort {
  if (view.sort?.key !== key) return { key, dir: "asc" };
  return view.sort.dir === "asc" ? { key, dir: "desc" } : null;
}
