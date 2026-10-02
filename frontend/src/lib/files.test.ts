import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRefreshStateForTests } from "@/lib/api/client";
import { openFileInNewTab } from "@/lib/files";

/** window.open 이 돌려주는 탭 흉내. 주소를 채웠는지·닫혔는지만 본다 */
function fakeTab() {
  return { location: { href: "" }, close: vi.fn() };
}

beforeEach(() => resetRefreshStateForTests());
afterEach(() => vi.unstubAllGlobals());

describe("openFileInNewTab", () => {
  it("탭을 먼저 열고, 파일을 받으면 그 탭 주소를 blob URL 로 채운다", async () => {
    const order: string[] = [];
    const tab = fakeTab();
    vi.stubGlobal("fetch", vi.fn(async () => {
      order.push("fetch");
      return new Response("PDFDATA", { status: 200, headers: { "Content-Type": "application/pdf" } });
    }));

    const result = await openFileInNewTab("private/listings/datasheets/2026/10/a.pdf", () => {
      order.push("open");
      return tab as unknown as Window;
    });

    expect(result.ok).toBe(true);
    expect(order).toEqual(["open", "fetch"]);
    expect(tab.location.href.startsWith("blob:")).toBe(true);
    expect(tab.close).not.toHaveBeenCalled();
  });

  it("파일을 못 받으면 열어 둔 탭을 닫고 실패 결과를 돌려준다", async () => {
    const tab = fakeTab();
    const notFound = { ok: false, code: "NOT_FOUND", message: "없음" };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(notFound), { status: 404, headers: { "Content-Type": "application/json" } })));

    const result = await openFileInNewTab("k.pdf", () => tab as unknown as Window);

    expect(result).toEqual(notFound);
    expect(tab.close).toHaveBeenCalled();
  });

  it("탭이 안 열리면(팝업 차단) 파일을 받지 않고 실패", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await openFileInNewTab("k.pdf", () => null);

    expect(result).toMatchObject({ ok: false, code: "POPUP_BLOCKED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
