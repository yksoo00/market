import { redirect } from "next/navigation";

// 옛 주소 — 내 활동내역 구매 탭으로
export default function MyPurchasesRedirect() {
  redirect("/my/activity?tab=purchases");
}
