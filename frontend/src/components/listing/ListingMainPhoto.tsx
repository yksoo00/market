"use client";

import { useState } from "react";
import { Icon } from "@/components/common/Icon";
import { fileUrl } from "@/lib/files";
import { listing } from "@/messages/listing";

const t = listing.detail;

/** 상세 대표 사진. 파일이 깨졌으면 alt 글자가 칸에 쏟아지지 않게 이미지 아이콘 자리로 바꾼다 (장바구니 카드와 같다) */
export function ListingMainPhoto({ photo, alt }: { photo: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (photo && !broken) {
    return (
      // 사진 비율대로 높이를 잡는다 — 정사각 상자에 넣으면 가로로 긴 사진 위아래가 배경으로 비어 자리만 차지한다.
      // 세로로 아주 긴 사진만 높이를 묶는다(전체 화면은 정보 표 높이 정도 22rem). API 서버의 공개 파일이라 next/image 원격 설정 없이 <img>
      // 누르면 원본을 새 탭 (나머지 사진과 같은 동작)
      <a href={fileUrl(photo)} target="_blank" rel="noopener noreferrer" aria-label={t.openOriginal(1)} className="shrink-0 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fileUrl(photo)} alt={alt} onError={() => setBroken(true)} className="w-full h-auto max-h-96 @min-[80rem]:max-h-88 object-contain rounded-md" />
      </a>
    );
  }
  return (
    <div className="shrink-0 aspect-square rounded-md border border-line-2 bg-bg flex items-center justify-center">
      <Icon name="image" size={40} className="text-ink-3" aria-hidden={false} aria-label={t.noPhoto} role="img" />
    </div>
  );
}
