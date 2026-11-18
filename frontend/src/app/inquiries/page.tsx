import type { Metadata } from "next";
import { InquiryBoard } from "@/components/inquiry/InquiryBoard";
import { inquiry as t } from "@/messages/inquiry";

export const metadata: Metadata = { title: t.page.title };

// TODO(사내 테스트용 익명 쓰기): 운영 공개 전 제거 (decisions.md 2026-11-18)
export default function InquiriesPage() {
  return (
    <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 py-4 @md:py-6">
      <div className="w-full max-w-[720px] mx-auto flex flex-col gap-4">
        <div className="flex flex-col gap-1 px-1">
          <h1 className="text-xl font-bold">{t.page.title}</h1>
          <p className="text-[13px] text-ink-2">{t.page.subtitle}</p>
        </div>
        <InquiryBoard />
      </div>
    </main>
  );
}
