import { safeNext } from "@/lib/safeNext";

// 로그인 ↔ 가입으로 이동할 때 떠나온 화면을 위 칸에 남긴다. 가입은 유형 선택(/signup)에만 로그인 링크가 있다.
export type PreviousPane =
  | { kind: "login"; next: string; initial: "personal" | "business"; search: string }
  | { kind: "signup" };

/**
 * 링크 클릭으로 이동하기 전에 위 칸을 어떻게 할지 정한다.
 * @param pathname 지금 경로, @param clickedPath 누른 링크의 경로, @param search 지금 주소의 쿼리(`?a=b` 또는 "")
 */
export function nextPrevious(
  current: PreviousPane | null,
  pathname: string,
  clickedPath: string,
  search: string
): PreviousPane | null {
  if (pathname === "/login" && clickedPath.startsWith("/signup")) {
    const params = new URLSearchParams(search);
    return {
      kind: "login",
      next: safeNext(params.get("next") ?? undefined),
      initial: params.get("type") === "business" ? "business" : "personal",
      // 돌아갈 때 원래 주소 그대로 복원한다 (next가 없던 /login이 ?next=%2F로 바뀌지 않게)
      search,
    };
  }
  if (pathname === "/signup" && clickedPath === "/login") {
    return { kind: "signup" };
  }
  // 같은 흐름 안의 이동(/signup → /signup/personal 등)은 위 칸을 유지하고, 흐름을 벗어나면 닫는다
  const section = pathname.startsWith("/signup") ? "/signup" : "/login";
  return clickedPath.startsWith(section) ? current : null;
}

/** 현재 칸을 닫으면 어디로 가는가: 위 칸(떠나온 화면)으로, 위 칸이 없으면 홈으로 */
export function closeDestination(previous: PreviousPane | null): string {
  if (previous?.kind === "login") return `/login${previous.search}`;
  if (previous?.kind === "signup") return "/signup";
  return "/";
}
