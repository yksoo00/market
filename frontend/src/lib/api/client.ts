import { UNREACHABLE, type ApiResult } from "@/types/api";
import { common as t } from "@/messages/common";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// 유일한 백엔드 호출 지점. 쿠키 인증이라 credentials 필수.
// TODO(인증 구현 시): 401 이면 /auth/refresh 한 번 시도 후 재요청
export async function api<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
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
  } catch {
    return { ok: false, code: UNREACHABLE, message: t.unreachable };
  }
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
