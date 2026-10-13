"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { Icon } from "@/components/common/Icon";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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

/** 서류를 크게 보는 창. ESC·바깥 클릭·× 로 닫는다. 공용 ui/dialog 에 크기만 넓혀 쓴다 */
export function FilePreviewDialog({ open, onOpenChange, title, url, media }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="flex h-[88vh] w-[min(96vw,60rem)] max-w-none flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <DialogTitle className="grow text-[15px]">{title}</DialogTitle>
          <a href={url} target="_blank" rel="noopener" className="text-[13px] text-primary font-medium hover:underline">
            {t.openInNewTab}
          </a>
          <DialogPrimitive.Close aria-label={t.close} className="size-8 rounded-md flex items-center justify-center text-ink-2 hover:bg-bg hover:text-ink">
            <Icon name="close" size={16} />
          </DialogPrimitive.Close>
        </div>
        {media === "pdf" ? (
          <iframe title={title} src={url} className="min-h-0 grow w-full rounded-md border border-line-2" />
        ) : (
          // blob 이라 next/image 대상이 아니다
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={title} className="min-h-0 grow w-full object-contain rounded-md bg-bg" />
        )}
      </DialogContent>
    </Dialog>
  );
}
