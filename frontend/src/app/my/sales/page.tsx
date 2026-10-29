import { redirect } from "next/navigation";
import { parseReg } from "@/lib/myTabs";
import type { RawSearchParams } from "@/lib/search";

// 옛 주소 — 내 활동내역 요청 탭으로 (?reg= 그 매물만 거르기는 그대로)
export default async function MySalesRedirect({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const reg = parseReg((await searchParams).reg);
  redirect(reg ? `/my/activity?tab=requests&reg=${reg}` : "/my/activity?tab=requests");
}
