import { UNREACHABLE, type ApiResult } from "@/types/api";
import { common as t } from "@/messages/common";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const REFRESH_PATH = "/api/v1/auth/refresh";

/**
 * 진행 중인 refresh 하나를 모든 요청이 공유한다. 탭 하나에서 요청 여러 개가 동시에 401 을 받으면 refresh 도 여러 번
 * 나가는데, 그러면 백엔드가 회전된 옛 토큰의 재사용으로 볼 수 있다 (30초 유예가 있지만 안 보내는 게 맞다).
 */
let refreshing: Promise<boolean> | null = null;

// 유일한 백엔드 호출 지점. 쿠키 인증이라 credentials 필수.
// access 토큰(15분)이 만료돼 401 이 오면 refresh 를 한 번 시도하고 같은 요청을 다시 보낸다.
// refresh 도 실패하면 원래 401 을 그대로 돌려준다 — 호출부가 로그인 화면으로 보낼 수 있게.
export async function api<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const first = await send<T>(path, init);
  // 인증 API 자체(로그인·refresh·로그아웃)의 401 은 "토큰 만료"가 아니라 그 요청의 결과라 재시도하지 않는다
  if (first.status !== 401 || path.startsWith("/api/v1/auth/")) return first.result;
  if (!(await refreshOnce())) return first.result;
  return (await send<T>(path, init)).result;
}

async function refreshOnce(): Promise<boolean> {
  refreshing ??= send<null>(REFRESH_PATH, { method: "POST" })
    .then((r) => r.result.ok)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function send<T>(path: string, init?: RequestInit): Promise<{ status: number; result: ApiResult<T> }> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: "include",
      // FormData 는 브라우저가 Content-Type 을 정해야 하므로 호출부가 headers: {} 로 끄면 JSON 헤더를 안 붙임
      headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers },
    });
    return { status: res.status, result: await parse<T>(res) };
  } catch {
    return { status: 0, result: { ok: false, code: UNREACHABLE, message: t.unreachable } };
  }
}

async function parse<T>(res: Response): Promise<ApiResult<T>> {
  // 5xx 는 본문이 우리 형식이 아닐 수 있음 (프록시 오류 페이지 등)
  if (res.status >= 500) return { ok: false, code: UNREACHABLE, message: t.serverError };
  if (res.status === 204) return { ok: true, data: null as T };
  try {
    const body: unknown = await res.json();
    // Spring 기본 오류 본문({timestamp,status,error})처럼 우리 형식이 아니면 상태코드로 판단
    if (typeof body === "object" && body !== null && typeof (body as { ok?: unknown }).ok === "boolean") {
      return body as ApiResult<T>;
    }
  } catch {
    // Spring Security 기본 401/403, rate limit 429 등은 본문이 빌 수 있음
  }
  return { ok: false, code: codeForStatus(res.status), message: t.serverError };
}

function codeForStatus(status: number): string {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 429) return "RATE_LIMITED";
  return `HTTP_${status}`;
}

export function post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}

/** 파일 업로드. Content-Type 은 브라우저가 multipart boundary 와 함께 붙이므로 직접 넣지 않는다 */
export async function upload<T>(path: string, form: FormData): Promise<ApiResult<T>> {
  return api<T>(path, { method: "POST", body: form, headers: {} });
}

/** 테스트용: 진행 중 refresh 상태 초기화 */
export function resetRefreshStateForTests(): void {
  refreshing = null;
}
