// 타일 큐가 "같은 화면인가·연관 있는가"를 판단하는 화면 표. 새 화면을 만들면 여기에 한 줄만 추가한다.
// 스펙: docs/superpowers/specs/2026-10-01-tile-queue-design.md "화면 표"

/** common은 어느 칸과도 연관 (홈·로그인·가입처럼 어디서든 옆에 열려도 되는 화면) */
export type TileGroup = "common" | "buy" | "sell";

export interface Screen {
  id: string;
  /** 표에 없는 화면은 null — 자기 화면 말고는 아무것과도 연관 없음(열면 리셋) */
  group: TileGroup | null;
}

// 배열 순서대로 매칭하므로 더 구체적인 경로를 위에 둔다 (/listings/new 가 상세보다, /quotes/adjust 가 /quotes 보다 먼저)
const SCREENS: { id: string; group: TileGroup; pattern: RegExp }[] = [
  { id: "home", group: "common", pattern: /^\/$/ },
  { id: "login", group: "common", pattern: /^\/login(\/.*)?$/ },
  { id: "signup", group: "common", pattern: /^\/signup(\/.*)?$/ },
  { id: "sellNew", group: "sell", pattern: /^\/listings\/new$/ },
  { id: "sellExtra", group: "sell", pattern: /^\/listings\/extra$/ },
  { id: "listingDetail", group: "common", pattern: /^\/listings\/[^/]+\/[^/]+$/ },
  { id: "sellQuote", group: "sell", pattern: /^\/quotes\/adjust$/ },
  { id: "buyQuotes", group: "buy", pattern: /^\/quotes$/ },
  { id: "search", group: "buy", pattern: /^\/search$/ },
  { id: "buyRequest", group: "buy", pattern: /^\/requests(\/.*)?$/ },
];

/** path는 쿼리·해시가 붙어 있어도 된다 */
export function screenOf(path: string): Screen {
  const pathname = path.split(/[?#]/)[0] || "/";
  const found = SCREENS.find((s) => s.pattern.test(pathname));
  return found ? { id: found.id, group: found.group } : { id: pathname, group: null };
}

/**
 * 새 화면이 열린 화면들과 연관 있는가.
 * 공통이면 항상 연관. 그룹 없는 화면은 공통 칸을 포함해 모든 칸이 자기 화면일 때만(= 사실상 리셋).
 * 그 외엔 열린 칸 중 공통이 아닌 칸이 전부 같은 그룹일 때.
 */
export function isRelated(target: Screen, open: readonly Screen[]): boolean {
  if (target.group === "common") return true;
  if (target.group === null) return open.every((s) => s.id === target.id);
  return open.filter((s) => s.group !== "common").every((s) => s.group === target.group);
}
