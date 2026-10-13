import { cn } from "cn";
import { fileUrl } from "@/lib/files";
import { listing } from "@/messages/listing";

const t = listing.detail;

/**
 * 대표 사진 아래에 나머지 사진을 두어, 옆 정보 표가 길 때 생기는 사진 아래 빈 자리를 채운다.
 * 공개 파일이라 주소를 그대로 쓰고, 누르면 원본을 새 탭. firstNo = 첫 사진의 전체 순번(대표가 1).
 *
 * 칸 폭 768~1279(반반 화면 등, 표가 한 쌍씩 쌓여 길 때)에만 그린다: 부모가 표 높이만큼 늘어나고, 이 목록이 남는 높이를 전부 차지하며
 * 사진 수에 맞춰 칸을 나눈다 (1장 = 통째, 2장 = 위아래, 3장 = 위 한 칸 + 아래 두 칸, 4장 = 2x2). 사진은 칸을 채우도록 잘려 보인다(원본은 눌러서).
 * 모바일(사진이 표 위로 쌓여 빈 곳이 없음)과 전체 화면(1280 이상, 사진 칸이 표 높이와 맞음)은 그리지 않고 아래 사진 카드(PhotosCard)가 보여준다 (사용자 지시).
 */
export function PhotoThumbs({ photos, firstNo }: { photos: string[]; firstNo: number }) {
  if (photos.length === 0) return null;
  const n = photos.length;
  return (
    <ul
      aria-label={t.photos}
      className={cn(
        "hidden gap-2 @md:grid @md:flex-1 @md:min-h-0 @md:auto-rows-fr @min-[80rem]:hidden",
        n <= 2 ? "grid-cols-1" : "grid-cols-2",
      )}
    >
      {photos.map((key, i) => (
        <li
          key={key}
          className={cn(
            "relative overflow-hidden rounded-md border border-line-2 bg-bg",
            n === 3 && i === 0 && "col-span-2",
          )}
        >
          <a href={fileUrl(key)} target="_blank" rel="noopener noreferrer" aria-label={t.openOriginal(firstNo + i)} className="absolute inset-0">
            {/* API 서버의 공개 파일이라 next/image 원격 설정 없이 <img> (ListingSummaryCard 와 같은 이유) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl(key)} alt="" className="h-full w-full object-cover" />
          </a>
        </li>
      ))}
    </ul>
  );
}
