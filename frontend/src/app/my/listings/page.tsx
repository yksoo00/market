import { redirect } from "next/navigation";
import { buildSearchHref, parseSearchParams, type RawSearchParams } from "@/lib/search";

// 옛 주소 — 내 활동내역 판매 탭으로 (북마크·옛 링크 호환. 검색 조건은 그대로 가져간다)
export default async function MyListingsRedirect({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  redirect(buildSearchHref(parseSearchParams(await searchParams, "mine"), "mine"));
}
