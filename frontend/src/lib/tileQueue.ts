import { isRelated, screenOf } from "@/lib/tileScreens";

// 화면 칸 상태 전이 (사용자 지시 2026-10-19, decisions.md "화면 칸은 홈 고정 · 주기능 · 보조").
// 넓은 화면은 [홈 | 주기능 | 보조] 고정 자리. 큐가 아니라 자리를 덮어쓴다:
//   - 홈 칸·헤더에서 열면 새 주기능 → [홈 | X] (보조는 닫힘)
//   - 주기능·보조 칸에서 연관 화면을 열면 보조 자리만 바뀜 → [홈 | 주기능 | X], 연관 없으면 새 주기능
// panes = [주기능, 보조?]. panes[0](주기능)이 주소창(Next 라우터가 그리는) 칸이고 홈은 칸 목록에 없다 —
// 주기능이 홈이 아니면 화면이 왼쪽에 홈 iframe 을 늘 붙인다(TileWorkspace). 주기능이 홈이면 홈 한 칸.

/** 칸 목록 최대 길이 (주기능 + 보조). 홈 칸은 세지 않는다 */
export const MAX_PANES = 2;
// 큐 시절(최대 3칸, 홈도 칸) 저장값을 새 의미로 잘못 읽지 않게 키를 바꿨다
export const STORAGE_KEY = "tile-panes-v2";
/** 왼쪽 홈 iframe 칸이 보내는 열기 요청의 출처 key. 헤더(앱 메뉴·사용자 메뉴 포함)도 이 출처로 본다 */
export const HOME_KEY = "home";

export interface Pane {
  key: string;
  path: string;
}

export type OpenAction =
  | { kind: "none" }
  /** 그 칸에서 경로만 바꾼다 (key 유지) */
  | { kind: "inPlace"; paneKey: string; path: string }
  /** 보조 자리를 이 경로로 (있으면 교체, 새 key 로 iframe 을 다시 연다) */
  | { kind: "sub"; path: string }
  /** 새 주기능. 보조는 닫힌다. 홈("/")이면 홈 한 칸 */
  | { kind: "main"; path: string };

const isHome = (path: string) => screenOf(path).id === "home";

export function decideOpen(
  panes: readonly Pane[],
  fromKey: string,
  path: string,
  opts: { reset: boolean; wide: boolean },
): OpenAction {
  if (opts.reset || panes.length === 0) return { kind: "main", path };
  const [main, sub] = panes;
  const target = screenOf(path);
  // 홈 한 칸일 때 그 화면에서 연 것도 홈에서 연 것
  const fromHome = fromKey === HOME_KEY || isHome(main.path);
  const from = fromHome ? null : sub && sub.key === fromKey ? sub : main;

  if (!opts.wide) {
    // 모바일 폭에선 분할하지 않는다 (사용자 지시). 주기능 한 칸만 보인다
    if (main.path === path) return { kind: "none" };
    return screenOf(main.path).id === target.id ? { kind: "inPlace", paneKey: main.key, path } : { kind: "main", path };
  }

  if (from === null) {
    if (target.id === "home") return { kind: "none" };
    if (main.path === path) return { kind: "none" };
    // 같은 기능을 다시 열면(홈에서 다시 검색 등) 주기능 자리에서 바뀌고 보조는 그대로
    if (screenOf(main.path).id === target.id) return { kind: "inPlace", paneKey: main.key, path };
    return { kind: "main", path };
  }

  if (target.id === "home") return { kind: "main", path };
  if (from.path === path) return { kind: "none" };
  if (screenOf(from.path).id === target.id) return { kind: "inPlace", paneKey: from.key, path };
  // 이미 그 주소로 열려 있으면 다시 불러오지 않는다 (입력하던 값이 지워지지 않게)
  if (sub?.path === path || main.path === path) return { kind: "none" };
  if (screenOf(main.path).id === target.id) return { kind: "inPlace", paneKey: main.key, path };
  return isRelated(target, [screenOf(main.path)]) ? { kind: "sub", path } : { kind: "main", path };
}

/** newKey 는 sub·main 의 새 칸 key (iframe 을 새 경로로 다시 마운트하려고) */
export function applyOpen(panes: readonly Pane[], action: OpenAction, newKey: string): Pane[] {
  switch (action.kind) {
    case "none":
      return [...panes];
    case "inPlace":
      return panes.map((p) => (p.key === action.paneKey ? { ...p, path: action.path } : p));
    case "sub":
      return [panes[0], { key: newKey, path: action.path }];
    case "main":
      return [{ key: newKey, path: action.path }];
  }
}

/** 보조를 닫으면 주기능만, 주기능을 닫으면 홈 한 칸 (홈 칸은 닫기 없음) */
export function closePane(panes: readonly Pane[], key: string, newKey: string): Pane[] {
  const [main, sub] = panes;
  if (sub?.key === key) return [main];
  if (main?.key === key && !isHome(main.path)) return [{ key: newKey, path: "/" }];
  return [...panes];
}

/**
 * iframe 칸이 링크가 아니라 코드로(?next= 로 온 로그인 성공 후 router.replace 등) 이동했다고 보고했을 때.
 * 다른 화면으로의 링크 클릭은 iframe 이 부모에 넘기므로, 여기서 화면이 바뀌었다면 코드 이동이다 →
 * 보조 칸이면 그 칸을 닫고 주기능 칸에서 연 것처럼 규칙대로 연다. 홈 칸이면 홈에서 연 것처럼.
 */
export function paneNavigated(panes: readonly Pane[], key: string, path: string, wide: boolean, newKey: string): Pane[] {
  if (key === HOME_KEY) {
    if (isHome(path)) return [...panes];
    return applyOpen(panes, decideOpen(panes, HOME_KEY, path, { reset: false, wide }), newKey);
  }
  const pane = panes.find((p) => p.key === key);
  if (!pane) return [...panes];
  if (screenOf(pane.path).id === screenOf(path).id) return panes.map((p) => (p.key === key ? { ...p, path } : p));
  const rest = panes.slice(0, 1);
  return applyOpen(rest, decideOpen(rest, rest[0].key, path, { reset: false, wide }), newKey);
}

/** 주소창 경로가 링크 밖의 이유(뒤로가기, router.push)로 바뀌었을 때. 다른 화면이면 새 주기능 */
export function syncMainPath(panes: readonly Pane[], fullPath: string, newKey: string): Pane[] {
  const main = panes[0];
  if (main.path === fullPath) return [...panes];
  if (screenOf(main.path).id === screenOf(fullPath).id) return [{ ...main, path: fullPath }, ...panes.slice(1)];
  return [{ key: newKey, path: fullPath }];
}

export function serializePanes(panes: readonly Pane[]): string {
  return JSON.stringify(panes);
}

/** 저장값의 주기능 칸이 지금 주소와 같을 때만 복원. 깨졌거나 다르면 null */
export function restorePanes(raw: string | null, currentPath: string): Pane[] | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PANES) return null;
  const valid = value.every(
    (p): p is Pane => typeof p === "object" && p !== null && typeof p.key === "string" && typeof p.path === "string",
  );
  if (!valid) return null;
  const panes = value as Pane[];
  if (panes[0].path !== currentPath) return null;
  // 홈 한 칸엔 보조가 없다
  return isHome(panes[0].path) ? panes.slice(0, 1) : panes;
}
