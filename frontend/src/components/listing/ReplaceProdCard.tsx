import { listing } from "@/messages/listing";

const t = listing.detail;

/** 카드 ③ 대체품. 파일이 아니라 판매자가 직접 적은 글이라 데이터시트·서류 카드와 따로 둔다 (decisions.md 2026-10-13) */
export function ReplaceProdCard({ replaceProd }: { replaceProd: string | null }) {
  return (
    <section className="rounded-md border border-line bg-surface p-4 @md:p-6 flex flex-col gap-3">
      <h2 className="text-[15px] font-bold text-ink">{t.docs.replaceProd}</h2>
      {replaceProd ? <p className="text-sm text-ink whitespace-pre-line wrap-break-word">{replaceProd}</p> : <p className="text-sm text-ink-3">{t.noReplaceProd}</p>}
    </section>
  );
}
