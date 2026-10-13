"use client";

import { Dialog } from "radix-ui";
import { Icon } from "@/components/common/Icon";
import { listing } from "@/messages/listing";

const t = listing.detail;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** 이미 받아 둔 blob 주소 */
  url: string;
  media: "pdf" | "image";
}

/** 서류를 크게 보는 창. ESC·바깥 클릭·× 로 닫는다 (radix Dialog: 포커스 가두기·스크롤 잠금 포함) */
export function FilePreviewDialog({ open, onOpenChange, title, url, media }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 flex h-[88vh] w-[min(96vw,60rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-2 rounded-md border border-line bg-surface p-3 outline-none"
        >
          <div className="flex items-center gap-2">
            <Dialog.Title className="grow text-[15px] font-bold text-ink">{title}</Dialog.Title>
            <a href={url} target="_blank" rel="noopener" className="text-[13px] text-primary font-medium hover:underline">
              {t.openInNewTab}
            </a>
            <Dialog.Close aria-label={t.close} className="size-8 rounded-md flex items-center justify-center text-ink-2 hover:bg-bg hover:text-ink">
              <Icon name="close" size={16} />
            </Dialog.Close>
          </div>
          {media === "pdf" ? (
            <iframe title={title} src={url} className="min-h-0 grow w-full rounded-md border border-line-2" />
          ) : (
            // blob 이라 next/image 대상이 아니다
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={title} className="min-h-0 grow w-full object-contain rounded-md bg-bg" />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
