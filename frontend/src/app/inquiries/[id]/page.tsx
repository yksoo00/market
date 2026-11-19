import type { Metadata } from "next";
import { InquiryDetailView } from "@/components/inquiry/InquiryDetailView";
import { inquiry as t } from "@/messages/inquiry";

export const metadata: Metadata = { title: t.page.title };

// TODO(사내 테스트용 익명 쓰기): 운영 공개 전 제거 (decisions.md 2026-11-18)
export default async function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 py-4 @md:py-6">
      <div className="w-full max-w-[720px] mx-auto flex flex-col gap-4">
        {/* key: 같은 칸에서 다른 글로 바뀔 때 이전 글의 화면·답글 입력 초안이 남지 않게 새로 만든다 */}
        <InquiryDetailView key={id} id={id} />
      </div>
    </main>
  );
}
