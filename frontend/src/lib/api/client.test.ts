import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, fetchFile, post, resetRefreshStateForTests } from "@/lib/api/client";

/** fetch 를 흉내낸다. 호출 순서대로 응답을 꺼내 쓰고, 어떤 경로가 몇 번 불렸는지 기록 */
// raw 가 있으면 JSON 대신 그 문자열을 type 으로 돌려준다 (파일 응답 흉내)
function mockFetch(responses: Array<{ status: number; body?: unknown; raw?: string; type?: string }>) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    calls.push(url.replace("http://localhost:8080", ""));
    const next = responses.shift();
    if (!next) throw new Error("예상보다 많은 요청: " + url);
    if (next.raw !== undefined) {
      return new Response(next.raw, { status: next.status, headers: { "Content-Type": next.type ?? "application/octet-stream" } });
    }
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), {
      status: next.status,
      headers: next.body === undefined ? {} : { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const ok = (data: unknown) => ({ status: 200, body: { ok: true, data } });
const unauthorized = { status: 401, body: { ok: false, code: "UNAUTHENTICATED", message: "로그인이 필요합니다." } };
const sessionExpired = { status: 401, body: { ok: false, code: "SESSION_EXPIRED", message: "다시 로그인해 주세요." } };

beforeEach(() => resetRefreshStateForTests());
afterEach(() => vi.unstubAllGlobals());

describe("api() — 401 이면 refresh 한 번 뒤 재시도", () => {
  it("첫 요청 401 → refresh 성공 → 같은 요청을 다시 보내 그 결과를 돌려준다", async () => {
    const calls = mockFetch([unauthorized, ok(null), ok({ id: "u1" })]);

    const result = await api<{ id: string }>("/api/v1/users/me");

    expect(result).toEqual({ ok: true, data: { id: "u1" } });
    expect(calls).toEqual(["/api/v1/users/me", "/api/v1/auth/refresh", "/api/v1/users/me"]);
  });

  it("refresh 도 실패하면 원래 401 을 그대로 돌려주고 더 시도하지 않는다", async () => {
    const calls = mockFetch([unauthorized, sessionExpired]);

    const result = await api("/api/v1/users/me");

    expect(result).toEqual(unauthorized.body);
    expect(calls).toEqual(["/api/v1/users/me", "/api/v1/auth/refresh"]);
  });

  it("인증 API 자체의 401 (로그인 실패 등) 은 재시도하지 않는다", async () => {
    const invalid = { status: 401, body: { ok: false, code: "INVALID_CREDENTIALS", message: "…" } };
    const calls = mockFetch([invalid]);

    const result = await post("/api/v1/auth/login", { loginId: "a", password: "b", remember: false });

    expect(result).toEqual(invalid.body);
    expect(calls).toEqual(["/api/v1/auth/login"]);
  });

  it("동시에 401 이 여러 개 와도 refresh 는 한 번만 나간다", async () => {
    // 요청 A·B 가 401 → refresh 1회 → A·B 재시도
    const calls = mockFetch([unauthorized, unauthorized, ok(null), ok("A"), ok("B")]);

    const [a, b] = await Promise.all([api<string>("/api/v1/a"), api<string>("/api/v1/b")]);

    expect(a).toEqual({ ok: true, data: "A" });
    expect(b).toEqual({ ok: true, data: "B" });
    expect(calls.filter((c) => c === "/api/v1/auth/refresh")).toHaveLength(1);
  });

  it("401 이 아닌 오류(403·429·5xx·네트워크)는 refresh 없이 그대로", async () => {
    const calls = mockFetch([{ status: 403, body: { ok: false, code: "FORBIDDEN", message: "…" } }, { status: 503 }]);

    expect(await api("/api/v1/x")).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(await api("/api/v1/y")).toMatchObject({ ok: false, code: "UNREACHABLE" });
    expect(calls).toEqual(["/api/v1/x", "/api/v1/y"]);

    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect(await api("/api/v1/z")).toMatchObject({ ok: false, code: "UNREACHABLE" });
  });

  it("본문이 우리 형식이 아닌 401 (빈 본문) 도 refresh 를 시도한다", async () => {
    const calls = mockFetch([{ status: 401 }, ok(null), ok("retried")]);

    expect(await api<string>("/api/v1/me")).toEqual({ ok: true, data: "retried" });
    expect(calls).toHaveLength(3);
  });
});

describe("fetchFile() — 파일을 Blob 으로, 401 이면 api() 와 같은 refresh", () => {
  const pdf = { status: 200, raw: "PDFDATA", type: "application/pdf" };

  it("200 이면 본문을 Blob 으로 돌려준다", async () => {
    mockFetch([pdf]);

    const result = await fetchFile("/api/v1/files/k");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await result.data.text()).toBe("PDFDATA");
    expect(result.data.type).toBe("application/pdf");
  });

  it("401 → refresh 성공 → 다시 받아 Blob", async () => {
    const calls = mockFetch([unauthorized, ok(null), pdf]);

    const result = await fetchFile("/api/v1/files/k");

    expect(result.ok).toBe(true);
    expect(calls).toEqual(["/api/v1/files/k", "/api/v1/auth/refresh", "/api/v1/files/k"]);
  });

  it("401 → refresh 도 실패하면 원래 401 결과 (화면은 이걸 보고 '로그인 후 열람'으로)", async () => {
    const calls = mockFetch([unauthorized, sessionExpired]);

    expect(await fetchFile("/api/v1/files/k")).toEqual(unauthorized.body);
    expect(calls).toEqual(["/api/v1/files/k", "/api/v1/auth/refresh"]);
  });

  it("404 JSON 오류 본문이면 그 실패 결과를 돌려준다", async () => {
    const notFound = { status: 404, body: { ok: false, code: "NOT_FOUND", message: "없음" } };
    mockFetch([notFound]);

    expect(await fetchFile("/api/v1/files/k")).toEqual(notFound.body);
  });

  it("네트워크 오류면 UNREACHABLE", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));

    expect(await fetchFile("/api/v1/files/k")).toMatchObject({ ok: false, code: "UNREACHABLE" });
  });
});
