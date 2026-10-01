// 타일 큐가 가로챌 링크 클릭·폼 제출인지 판별. DOM 대신 필요한 값만 받아 node에서 테스트한다.

export interface ClickInfo {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

export interface AnchorInfo {
  href: string;
  target: string;
  hasDownload: boolean;
  /** 로고처럼 항상 리셋하는 링크 (data-tile="reset") */
  tileReset: boolean;
}

export interface FormInfo {
  method: string;
  action: string;
  /** React 19 action={함수} 폼은 서버 액션이라 건드리지 않는다 */
  hasFunctionAction: boolean;
  entries: [string, string][];
}

export type Intercept = { path: string; reset: boolean } | null;

function sameOriginPath(url: string, origin: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url, origin);
  } catch {
    return null;
  }
  if (parsed.origin !== origin) return null;
  return parsed.pathname + parsed.search + parsed.hash;
}

/** 새 탭·다운로드·수정키 클릭 등은 브라우저 기본 동작에 맡긴다 */
export function linkIntercept(click: ClickInfo, anchor: AnchorInfo, origin: string): Intercept {
  if (click.defaultPrevented || click.button !== 0) return null;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null;
  if ((anchor.target && anchor.target !== "_self") || anchor.hasDownload) return null;
  const path = sameOriginPath(anchor.href, origin);
  return path === null ? null : { path, reset: anchor.tileReset };
}

export function formIntercept(form: FormInfo, origin: string): Intercept {
  if (form.method.toLowerCase() !== "get" || form.hasFunctionAction) return null;
  const path = sameOriginPath(form.action, origin);
  if (path === null) return null;
  const query = new URLSearchParams(form.entries).toString();
  return { path: `${path.split(/[?#]/)[0]}${query ? `?${query}` : ""}`, reset: false };
}
