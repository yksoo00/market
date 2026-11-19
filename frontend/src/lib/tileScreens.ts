// 화면 칸 규칙(lib/tileQueue)이 "같은 화면인가·연관 있는가"를 판단하는 화면 표. 연관 있으면 보조 칸, 없으면 새 주기능. 새 화면을 만들면 여기에 한 줄만 추가한다.
// 규칙: decisions.md 2026-10-19 (화면 표 형식은 docs/superpowers/specs/2026-10-01-tile-queue-design.md "화면 표" 그대로)

/** common은 어느 칸과도 연관 (홈·로그인·가입처럼 어디서든 옆에 열려도 되는 화면) */
export type TileGroup = "common" | "buy" | "sell";

export interface Screen {
  id: string;
  /** 표에 없는 화면은 null — 자기 화면 말고는 아무것과도 연관 없음(열면 새 주기능) */
  group: TileGroup | null;
}

// 배열 순서대로 매칭하므로 더 구체적인 경로를 위에 둔다 (/listings/new 가 상세보다, /quotes/adjust 가 /quotes 보다 먼저)
// aux: 보조형 화면(장바구니·비교) — 검색에서 담은 것을 확인하는 참고 칸이라 검색이 주기능 자리, 이 화면은 보조 자리 (decisions.md 2026-11-03)
const SCREENS: { id: string; group: TileGroup; pattern: RegExp; solo?: true; aux?: true }[] = [
  { id: "home", group: "common", pattern: /^\/$/ },
  // 로그인·가입은 같은 화면(auth): 로그인 칸에서 [회원가입]을 누르면 칸을 더 쌓지 않고 그 칸이 가입으로 바뀐다 (decisions.md 2026-10-13)
  { id: "auth", group: "common", pattern: /^\/(login|signup)(\/.*)?$/ },
  { id: "sellNew", group: "sell", pattern: /^\/listings\/new$/ },
  { id: "sellExtra", group: "sell", pattern: /^\/listings\/extra$/ },
  { id: "sellBulk", group: "sell", pattern: /^\/listings\/bulk$/ },
  { id: "buyBulk", group: "buy", pattern: /^\/buy\/bulk$/ },
  // 내 활동내역은 탭(요청·판매·구매)을 옮겨도 같은 화면 — 칸을 더 쌓지 않고 그 칸에서 바뀐다. 판매·구매 양쪽 일이라 공통. 옛 주소(listings·sales·purchases)는 새 주소로 넘어가는 화면이라 같이 센다
  { id: "myActivity", group: "common", pattern: /^\/my\/(activity|listings|sales|purchases)$/ },
  { id: "myHistory", group: "common", pattern: /^\/my\/history$/ },
  { id: "myCart", group: "buy", pattern: /^\/my\/cart$/, aux: true },
  { id: "cartCompare", group: "buy", pattern: /^\/my\/cart\/compare$/, aux: true },
  { id: "my", group: "common", pattern: /^\/my$/ },
  { id: "listingDetail", group: "common", pattern: /^\/listings\/[^/]+\/[^/]+$/ },
  { id: "listingEdit", group: "sell", pattern: /^\/listings\/[^/]+\/[^/]+\/edit$/ },
  { id: "listingExtraForm", group: "sell", pattern: /^\/listings\/[^/]+\/[^/]+\/extra$/ },
  { id: "sellQuote", group: "sell", pattern: /^\/quotes\/adjust$/ },
  { id: "buyQuotes", group: "buy", pattern: /^\/quotes$/ },
  { id: "search", group: "buy", pattern: /^\/search$/ },
  { id: "buyRequest", group: "buy", pattern: /^\/requests(\/.*)?$/ },
  // 사내 테스트용 익명 문의 게시판 — 어느 칸 옆에서 열어도 보조로 뜰 수 있게 공통 (운영 공개 전 제거, decisions.md 2026-11-18)
  { id: "inquiryDetail", group: "common", pattern: /^\/inquiries\/[^/]+$/ },
  { id: "inquiries", group: "common", pattern: /^\/inquiries$/ },
  // 로컬 전용 임시 테이블 관리. 표가 넓어 홈·보조 칸 없이 혼자 전체화면 (사용자 지시 2026-10-30)
  { id: "devTables", group: "common", pattern: /^\/dev\/tables$/, solo: true },
];

/** 혼자 전체화면으로 뜨는 화면인가 — 홈 칸·보조 칸을 붙이지 않는다 (path 는 쿼리·해시가 붙어도 된다) */
export function isSolo(path: string): boolean {
  const pathname = path.split(/[?#]/)[0] || "/";
  return SCREENS.find((s) => s.pattern.test(pathname))?.solo === true;
}

/** 보조형 화면(장바구니·비교)인가 — 검색을 열면 검색이 주기능, 이 화면이 보조 자리로 간다 (path 는 쿼리·해시가 붙어도 된다) */
export function isAux(path: string): boolean {
  const pathname = path.split(/[?#]/)[0] || "/";
  return SCREENS.find((s) => s.pattern.test(pathname))?.aux === true;
}

/** path는 쿼리·해시가 붙어 있어도 된다 */
export function screenOf(path: string): Screen {
  const pathname = path.split(/[?#]/)[0] || "/";
  const found = SCREENS.find((s) => s.pattern.test(pathname));
  return found ? { id: found.id, group: found.group } : { id: pathname, group: null };
}

/**
 * 새 화면이 열린 화면들과 연관 있는가.
 * 공통이면 항상 연관. 그룹 없는 화면은 공통 칸을 포함해 모든 칸이 자기 화면일 때만(= 사실상 새 주기능).
 * 그 외엔 열린 칸 중 공통이 아닌 칸이 전부 같은 그룹일 때.
 */
export function isRelated(target: Screen, open: readonly Screen[]): boolean {
  if (target.group === "common") return true;
  if (target.group === null) return open.every((s) => s.id === target.id);
  return open.filter((s) => s.group !== "common").every((s) => s.group === target.group);
}
