import { Icon } from "@/components/common/Icon";
import { ListingActions } from "@/components/listing/ListingActions";
import { fileUrl } from "@/lib/files";
import { infoRows, mainPhoto } from "@/lib/listingDetail";
import { listing } from "@/messages/listing";
import type { ListingDetail } from "@/types/listing";

const t = listing.detail;

/** 카드 ① 상품 상세 내역 — 사용자가 준 화면 순서(제목 · 사진 | 정보 표 · 제품 개요) */
export function ListingSummaryCard({ detail, owner }: { detail: ListingDetail; owner: boolean }) {
  const photo = mainPhoto(detail);

  return (
    <section className="rounded-md border border-line bg-surface p-4 @md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-[22px] font-bold text-ink">{detail.prodName}</span>
          {detail.prodNo && <span className="num text-[15px] text-ink-2">{detail.prodNo}</span>}
          {detail.tradeStatus === "completed" && (
            <span className="inline-flex items-center h-5 px-1.5 rounded-[5px] bg-line-2 text-ink-2 text-[11px] font-semibold">
              {t.completedBadge}
            </span>
          )}
        </h1>
        {detail.prodSpecInfo && <p className="text-[13px] text-ink-2">{detail.prodSpecInfo}</p>}
      </header>

      <div className="mt-4 flex flex-col @md:flex-row gap-5">
        <div className="w-full @md:w-80 shrink-0 aspect-square rounded-md border border-line-2 bg-bg flex items-center justify-center overflow-hidden">
          {photo ? (
            // 사진은 API 서버의 공개 파일이라 next/image 를 쓰면 원격 호스트 설정이 필요해진다 — 그대로 <img>
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl(photo)} alt={detail.prodName} className="w-full h-full object-contain" />
          ) : (
            <Icon name="image" size={40} className="text-ink-3" aria-label={t.noPhoto} role="img" />
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <dl className="grid grid-cols-[7rem_1fr] text-sm">
            {infoRows(detail).map((row) => (
              <div key={row.label} className="contents">
                <dt className="py-2 border-b border-line-2 text-ink-2">{row.label}</dt>
                <dd
                  className={`py-2 border-b border-line-2 min-w-0 break-words ${row.value === t.empty ? "text-ink-3" : "text-ink"} ${row.mono ? "num" : ""}`}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          <ListingActions detail={detail} owner={owner} />
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-line-2 flex flex-col gap-2">
        <h2 className="text-[15px] font-bold text-ink">{t.overview}</h2>
        {detail.description ? (
          <p className="text-sm text-ink whitespace-pre-line">{detail.description}</p>
        ) : (
          <p className="text-sm text-ink-3">{t.noDescription}</p>
        )}
      </div>
    </section>
  );
}
