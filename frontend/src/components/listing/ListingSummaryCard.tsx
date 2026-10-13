import { Icon } from "@/components/common/Icon";
import { ListingActions } from "@/components/listing/ListingActions";
import { PhotoThumbs } from "@/components/listing/PhotoThumbs";
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
        {/* 이 칸은 옆 정보 표 높이만큼 늘어나고(stretch), 대표 사진은 제 비율대로, 768~1279 에선 그 아래 나머지 사진이 남는 높이를 채운다 (PhotoThumbs).
            모바일·전체 화면의 나머지 사진은 아래 사진 카드(PhotosCard) */}
        <div className="w-full @md:w-80 @min-[80rem]:w-150 shrink-0 flex flex-col gap-2">
          {photo ? (
            // 사진 비율대로 높이를 잡는다 — 정사각 상자에 넣으면 가로로 긴 사진 위아래가 배경으로 비어 자리만 차지한다.
            // 세로로 아주 긴 사진만 높이를 묶는다(전체 화면은 정보 표 높이 정도 22rem). API 서버의 공개 파일이라 next/image 원격 설정 없이 <img>
            // 누르면 원본을 새 탭 (나머지 사진과 같은 동작)
            <a href={fileUrl(photo)} target="_blank" rel="noopener noreferrer" aria-label={t.openOriginal(1)} className="shrink-0 block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl(photo)} alt={detail.prodName} className="w-full h-auto max-h-96 @min-[80rem]:max-h-88 object-contain rounded-md" />
            </a>
          ) : (
            <div className="shrink-0 aspect-square rounded-md border border-line-2 bg-bg flex items-center justify-center">
              <Icon name="image" size={40} className="text-ink-3" aria-hidden={false} aria-label={t.noPhoto} role="img" />
            </div>
          )}
          <PhotoThumbs photos={detail.photos.slice(1)} firstNo={2} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* 전체 화면(칸 폭 1280 이상)에선 라벨·값 두 쌍을 한 줄에 두고, 값이 짧아 남는 폭만큼 사진 칸을 600px 로 넓혀 가로 사진이면 높이가 표와 맞는다 (사용자 지시).
              그보다 좁은 칸(768~1279)은 한 쌍씩 쌓고 사진 아래 나머지 사진이 표 높이까지 채운다 — 1024~1279 에서 두 쌍 + 320px 사진이면 사진 아래가 비었다 */}
          <dl className="grid grid-cols-[7rem_1fr] @min-[80rem]:grid-cols-[6rem_1fr_6rem_1fr] text-sm">
            {infoRows(detail).map((row) => (
              <div key={row.label} className="contents">
                <dt className="py-2 border-b border-line-2 text-ink-2">{row.label}</dt>
                <dd
                  className={`py-2 @min-[80rem]:pr-4 border-b border-line-2 min-w-0 break-words ${row.value === t.empty ? "text-ink-3" : "text-ink"} ${row.mono ? "num" : ""}`}
                >
                  {row.value}
                </dd>
              </div>
            ))}
            {/* 행 수가 홀수면 두 쌍 배치의 마지막 줄 오른쪽이 비어 아래 선이 반만 그어진다 — 선만 있는 빈 칸으로 채운다 */}
            {infoRows(detail).length % 2 === 1 && (
              <div aria-hidden="true" className="hidden @min-[80rem]:contents">
                <span className="border-b border-line-2" />
                <span className="border-b border-line-2" />
              </div>
            )}
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
