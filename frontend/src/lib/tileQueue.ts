import { isRelated, screenOf } from "@/lib/tileScreens";

// 타일 큐 상태 전이. 칸 목록은 오래된 순이고 panes[0]이 주소창(Next 라우터가 그리는) 칸.
// 스펙: docs/superpowers/specs/2026-10-01-tile-queue-design.md

export const MAX_PANES = 3;
export const STORAGE_KEY = "tile-panes";

export interface Pane {
  key: string;
  path: string;
}

export type OpenAction =
  | { kind: "none" }
  | { kind: "inPlace"; paneKey: string; path: string }
  | { kind: "replace"; paneKey: string; path: string }
  | { kind: "push"; path: string }
  | { kind: "reset"; path: string };

export function decideOpen(
  panes: readonly Pane[],
  fromKey: string,
  path: string,
  opts: { reset: boolean; wide: boolean },
): OpenAction {
  if (opts.reset) return { kind: "reset", path };
  const from = panes.find((p) => p.key === fromKey) ?? panes[0];
  if (from.path === path) return { kind: "none" };
  const target = screenOf(path);
  if (screenOf(from.path).id === target.id) return { kind: "inPlace", paneKey: from.key, path };
  // 모바일 폭에선 분할하지 않는다 (사용자 지시). 숨은 칸을 바꾸면 클릭이 무반응처럼 보이므로 교체보다 먼저 본다
  if (!opts.wide) return { kind: "reset", path };
  const sameScreen = panes.find((p) => screenOf(p.path).id === target.id);
  // 이미 그 주소로 열려 있으면 다시 불러오지 않는다 (입력하던 값이 지워지지 않게)
  if (sameScreen?.path === path) return { kind: "none" };
  if (sameScreen) return { kind: "replace", paneKey: sameScreen.key, path };
  return isRelated(target, panes.map((p) => screenOf(p.path))) ? { kind: "push", path } : { kind: "reset", path };
}

/** newKey는 push·reset의 새 칸, replace의 바뀐 칸 key (iframe을 새 경로로 다시 마운트하려고) */
export function applyOpen(panes: readonly Pane[], action: OpenAction, newKey: string): Pane[] {
  switch (action.kind) {
    case "none":
      return [...panes];
    case "inPlace":
      return panes.map((p) => (p.key === action.paneKey ? { ...p, path: action.path } : p));
    case "replace":
      return panes.map((p) => (p.key === action.paneKey ? { key: newKey, path: action.path } : p));
    case "push":
      // 가득 차면 가장 오래된 칸(panes[0])이 빠지고 나머지가 한 칸씩 당겨진다
      return [...panes, { key: newKey, path: action.path }].slice(-MAX_PANES);
    case "reset":
      return [{ key: newKey, path: action.path }];
  }
}

export function closePane(panes: readonly Pane[], key: string): Pane[] {
  if (panes.length <= 1) return [...panes];
  return panes.filter((p) => p.key !== key);
}

/**
 * iframe 칸이 링크가 아니라 코드로(로그인 성공 후 router.push, 로그인 상태면 홈으로 보내기 등) 이동했다고 보고했을 때.
 * 다른 화면으로의 링크 클릭은 iframe이 부모 큐에 넘기므로, 여기서 화면이 바뀌었다면 코드 이동이다 →
 * 그 칸을 닫고 그 경로를 주소창 칸에서 연 것처럼 큐 규칙으로 연다 (로그인 후 홈이면 이미 홈이 있어 칸만 닫힘).
 */
export function paneNavigated(panes: readonly Pane[], key: string, path: string, wide: boolean, newKey: string): Pane[] {
  const pane = panes.find((p) => p.key === key);
  if (!pane) return [...panes];
  if (screenOf(pane.path).id === screenOf(path).id) return panes.map((p) => (p.key === key ? { ...p, path } : p));
  const rest = closePane(panes, key);
  return applyOpen(rest, decideOpen(rest, rest[0].key, path, { reset: false, wide }), newKey);
}

/** 주소창 경로가 링크 밖의 이유(뒤로가기, router.push)로 바뀌었을 때 */
export function syncMainPath(panes: readonly Pane[], fullPath: string, newKey: string): Pane[] {
  const main = panes[0];
  if (main.path === fullPath) return [...panes];
  if (screenOf(main.path).id === screenOf(fullPath).id) return [{ ...main, path: fullPath }, ...panes.slice(1)];
  return [{ key: newKey, path: fullPath }];
}

export function serializePanes(panes: readonly Pane[]): string {
  return JSON.stringify(panes);
}

/** 저장값의 주소창 칸이 지금 주소와 같을 때만 복원. 깨졌거나 다르면 null */
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
  return panes[0].path === currentPath ? panes : null;
}
