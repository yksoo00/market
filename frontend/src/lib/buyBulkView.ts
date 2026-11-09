import { hasErrors, type BuyLine } from "@/lib/buyBulk";

// 대량구매 표의 필터·검색·정렬 (계획 2026-11-09-bulk-purchase-excel.md). 서버에는 줄이 없어 전부 브라우저에서 한다.
// 판매 다량 등록(lib/bulkListingView)과 같은 규칙: 정렬은 열(드롭다운)을 바꿀 때만 다시 돌고, 칸을 고쳐도 줄 순서는 그대로다.

export type BuyTab = "all" | "available" | "unavailable" | "failed" | "done";

export type BuySortKey = "rowNo" | "prodName" | "prodBrand" | "orderQuantity" | "unitPrice" | "status";

export type BuySort = { key: BuySortKey; dir: "asc" | "desc" } | null;

export interface BuyView {
  tab: BuyTab;
  query: string;
  sort: BuySort;
}

/** 처음엔 담지 않은 줄 전부, 정렬 없음(= 엑셀 행 번호 순) */
export const initialBuyView: BuyView = { tab: "all", query: "", sort: null };

/** 한 줄이 속하는 탭 (all 은 따로 — 담김을 뺀 전부). 오류가 있으면 확인 필요 */
export function tabOf(line: BuyLine): Exclude<BuyTab, "all"> {
  if (line.added) return "done";
  if (hasErrors(line)) return "failed";
  return line.result.status === "UNAVAILABLE" ? "unavailable" : "available";
}

export function tabCounts(lines: BuyLine[]): Record<BuyTab, number> {
  const counts: Record<BuyTab, number> = { all: 0, available: 0, unavailable: 0, failed: 0, done: 0 };
  for (const l of lines) {
    const tab = tabOf(l);
    counts[tab] += 1;
    if (tab !== "done") counts.all += 1;
  }
  return counts;
}

const matches = (line: BuyLine, query: string): boolean => {
  if (query === "") return true;
  const q = query.toLowerCase();
  return [line.fields.prodName, line.fields.prodBrand, line.result.matchedName ?? ""].some((s) => s.toLowerCase().includes(q));
};

/** 쉼표를 뗀 수. 숫자가 아니면 NaN — 정렬에서 맨 뒤로 */
const numberOf = (s: string): number => (/^-?\d+$/.test(s.replace(/,/g, "").trim()) ? Number(s.replace(/,/g, "").trim()) : Number.NaN);

/** 오름차순에서 오류 → 매물 없음 → 매물 있음 (문제 있는 줄을 먼저 보려는 정렬) */
const STATUS_ORDER: Record<Exclude<BuyTab, "all">, number> = { failed: 0, unavailable: 1, available: 2, done: 3 };

/** 정렬 값. 고른 매물이 없으면(매물 없음·오류) NaN — 방향과 상관없이 맨 뒤 */
function valueOf(line: BuyLine, key: Extract<BuySortKey, "orderQuantity" | "unitPrice">): number {
  return key === "orderQuantity" ? numberOf(line.fields.orderQuantity) : (line.result.chosen?.unitPrice ?? Number.NaN);
}

function compare(a: BuyLine, b: BuyLine, key: BuySortKey): number {
  switch (key) {
    case "rowNo":
      return a.rowNo - b.rowNo;
    case "prodName":
      return a.fields.prodName.localeCompare(b.fields.prodName, "ko");
    case "prodBrand":
      return a.fields.prodBrand.localeCompare(b.fields.prodBrand, "ko");
    case "orderQuantity":
    case "unitPrice": {
      const [x, y] = [valueOf(a, key), valueOf(b, key)];
      return Number.isNaN(x) || Number.isNaN(y) ? 0 : x - y;
    }
    case "status":
      return STATUS_ORDER[tabOf(a)] - STATUS_ORDER[tabOf(b)];
  }
}

const isMissing = (line: BuyLine, key: BuySortKey): boolean => (key === "orderQuantity" || key === "unitPrice") && Number.isNaN(valueOf(line, key));

/** 탭 → 검색 → 정렬 순으로 지금 보일 줄. 입력 배열은 바꾸지 않는다 */
export function visibleLines(lines: BuyLine[], view: BuyView): BuyLine[] {
  const query = view.query.trim();
  const shown = lines.filter((l) => (view.tab === "all" ? !l.added : tabOf(l) === view.tab) && matches(l, query));
  const sort = view.sort ?? { key: "rowNo", dir: "asc" };
  const sign = sort.dir === "asc" ? 1 : -1;
  // 같으면 행 번호 순 — 정렬이 매번 같은 결과가 되게
  return [...shown].sort((a, b) => {
    const [missingA, missingB] = [isMissing(a, sort.key), isMissing(b, sort.key)];
    if (missingA !== missingB) return missingA ? 1 : -1;
    return sign * compare(a, b, sort.key) || a.rowNo - b.rowNo;
  });
}
