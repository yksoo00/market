import { ListingActions } from "@/components/listing/ListingActions";
import { ListingMainPhoto } from "@/components/listing/ListingMainPhoto";
import { PhotoThumbs } from "@/components/listing/PhotoThumbs";
import { infoRows, mainPhoto } from "@/lib/listingDetail";
import { listing } from "@/messages/listing";
import type { ListingDetail } from "@/types/listing";

const t = listing.detail;

/** 카드 ① 상품 상세 내역 — 사용자가 준 화면 순서(제목 · 사진 | 정보 표 · 제품 개요) */
/** meId·anonymous: [구매] 판단용 (ListingActions) */
export function ListingSummaryCard({
  detail,
  owner,
  meId,
  anonymous,
  onPurchased,
}: {
  detail: ListingDetail;
  owner: boolean;
  meId: string | null;
  anonymous: boolean;
  onPurchased?: () => void;
}) {
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
        {/* 이 칸은 옆 정보 표 높이만큼 늘어나고(stretch), 대표 사진은 제 비율대로, 768~1279 에선 그 아래 나머지 사진이 남는 높이를 채운다 (PhotoThumbs).
            모바일·전체 화면의 나머지 사진은 아래 사진 카드(PhotosCard) */}
        <div className="w-full @md:w-80 @min-[80rem]:w-150 shrink-0 flex flex-col gap-2">
          <ListingMainPhoto key={photo ?? "none"} photo={photo} alt={detail.prodName} />
          <PhotoThumbs photos={detail.photos.slice(1)} firstNo={2} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* 정보 표 칸 자체의 폭(30rem 이상)을 기준으로 라벨·값 두 쌍을 한 줄에 둔다 — 세로로 길게 늘어지지 않게 (사용자 지시 2026-11-04).
              전체 화면은 값이 짧아 남는 폭만큼 사진 칸을 600px 로 넓혀 가로 사진이면 높이가 표와 맞는다. 좁은 칸·폰은 한 쌍씩 */}
          <div className="@container">
            <dl className="grid grid-cols-[7rem_1fr] @min-[30rem]:grid-cols-[6rem_1fr_6rem_1fr] text-sm">
              {infoRows(detail).map((row) => (
                <div key={row.label} className="contents">
                  <dt className="py-2 border-b border-line-2 text-ink-2">{row.label}</dt>
                  <dd
                    className={`py-2 @min-[30rem]:pr-4 border-b border-line-2 min-w-0 break-words ${row.value === t.empty ? "text-ink-3" : "text-ink"} ${row.mono ? "num" : ""}`}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
              {/* 행 수가 홀수면 두 쌍 배치의 마지막 줄 오른쪽이 비어 아래 선이 반만 그어진다 — 선만 있는 빈 칸으로 채운다 */}
              {infoRows(detail).length % 2 === 1 && (
                <div aria-hidden="true" className="hidden @min-[30rem]:contents">
                  <span className="border-b border-line-2" />
                  <span className="border-b border-line-2" />
                </div>
              )}
            </dl>
          </div>
          <ListingActions detail={detail} owner={owner} meId={meId} anonymous={anonymous} onPurchased={onPurchased} />
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
