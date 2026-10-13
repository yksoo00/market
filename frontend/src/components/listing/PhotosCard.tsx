import { fileUrl } from "@/lib/files";
import { listing } from "@/messages/listing";

const t = listing.detail;

/**
 * 카드 사진. 공개 파일이라 주소를 그대로 쓴다. 누르면 원본을 새 탭 (확대 보기 창은 범위 밖).
 * 모바일·전체 화면(칸 폭 1280 이상) 모두 대표 사진을 포함한 전체 사진 (사용자 지시).
 * 768~1279 는 나머지 사진이 대표 사진 아래(PhotoThumbs)에 있어 이 카드를 그리지 않는다 (사용자 지시)
 */
export function PhotosCard({ photos }: { photos: string[] }) {
  return (
    <section className="rounded-md border border-line bg-surface p-4 @md:p-6 flex flex-col gap-3 @md:hidden @min-[80rem]:flex">
      <h2 className="text-[15px] font-bold text-ink">{t.photos}</h2>
      {photos.length === 0 ? (
        <p className="text-sm text-ink-3">{t.noPhotos}</p>
      ) : (
        <div className="grid grid-cols-2 @md:grid-cols-4 gap-2">
          {photos.map((key, i) => (
            <a key={key} href={fileUrl(key)} target="_blank" rel="noopener noreferrer" aria-label={t.openOriginal(i + 1)}>
              {/* API 서버의 공개 파일이라 next/image 원격 설정 없이 <img> (ListingSummaryCard 와 같은 이유) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl(key)} alt="" className="w-full aspect-square object-cover rounded-md border border-line-2 bg-bg" />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
