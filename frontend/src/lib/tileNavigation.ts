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
  /**
   * action 속성을 명시한 폼만 이동용 폼으로 본다. onSubmit만 있는 폼(로그인·가입 등)은 method 기본값이 GET이라
   * 가로채면 비밀번호가 주소창·서버 로그에 실린다 (최종 리뷰 Critical)
   */
  hasActionAttr: boolean;
  /** 앱 핸들러(react-hook-form handleSubmit 등)가 이미 막은 제출 */
  defaultPrevented: boolean;
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
  if (!form.hasActionAttr || form.defaultPrevented || form.method.toLowerCase() !== "get") return null;
  // 서버 액션 폼(action={함수})은 action이 javascript: 라 아래 출처 비교에서 걸러진다
  const path = sameOriginPath(form.action, origin);
  if (path === null) return null;
  const query = new URLSearchParams(form.entries).toString();
  return { path: `${path.split(/[?#]/)[0]}${query ? `?${query}` : ""}`, reset: false };
}
