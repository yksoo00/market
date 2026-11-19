"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Icon } from "@/components/common/Icon";
import { Checkbox } from "@/components/ui/checkbox";
import { cartActionable, cartLineAmount, nextCartQuantity, remainingMinutes } from "@/lib/cart";
import { fileUrl } from "@/lib/files";
import { formatPrice } from "@/lib/format";
import { cart } from "@/messages/cart";
import { listing as listingText } from "@/messages/listing";
import type { CartItem } from "@/types/cart";

const t = cart.page;
const stepper = "size-7 inline-flex items-center justify-center rounded-md border border-line text-ink hover:bg-bg disabled:text-ink-3 disabled:hover:bg-transparent";

interface Props {
  item: CartItem;
  checked: boolean;
  onCheckedChange: () => void;
  /** 이 줄의 수량을 저장하는 중 — +/- 를 막아 겹쳐 보내지 않게 */
  quantityBusy: boolean;
  /** 빼는 중 — 삭제 버튼을 막아 두 번 보내지 않게 */
  removing: boolean;
  onChangeQuantity: (quantity: number) => void;
  onRemove: () => void;
  onOpen: () => void;
}

/**
 * 장바구니 카드 한 장 (사용자 지시 2026-11-03, 쿠팡 느낌). 사진 · 품명 · 제조사·상품코드 · 상품상태·재고·납품희망일 · 남은 시간,
 * 오른쪽에 담은 수량 −/+ · 금액(단가 × 수량) · 삭제. 칸 폭 576 미만이면 오른쪽 덩어리가 아래로 내려간다.
 */
export function CartCard({ item, checked, onCheckedChange, quantityBusy, removing, onChangeQuantity, onRemove, onOpen }: Props) {
  const l = item.listing;
  const done = !cartActionable(l);
  const down = nextCartQuantity(l, item.orderQuantity, "down");
  const up = nextCartQuantity(l, item.orderQuantity, "up");
  const left = remainingMinutes(item.addedAt);
  const price = formatPrice(l.salesUnitPrice);
  // 사진 파일이 없거나 깨졌으면 alt 글자가 사진 칸에 쏟아지지 않게 이미지 아이콘 자리로 바꾼다
  const [photoBroken, setPhotoBroken] = useState(false);
  return (
    <li
      className={`grid grid-cols-[auto_auto_1fr] @min-[36rem]:grid-cols-[auto_auto_1fr_auto] items-start gap-x-3 gap-y-3 rounded-md border bg-surface p-3 @min-[36rem]:p-4 ${checked ? "border-primary" : "border-line"}`}
    >
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} aria-label={t.selectRow(l.prodName)} className="mt-1" />
      {l.mainPhoto && !photoBroken ? (
        // API 서버의 공개 파일이라 next/image 원격 설정 없이 <img> (ListingSummaryCard 와 같은 이유)
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fileUrl(l.mainPhoto)}
          alt={l.prodName}
          onError={() => setPhotoBroken(true)}
          className="size-20 @min-[36rem]:size-24 rounded-md bg-bg object-contain"
        />
      ) : (
        <div className="size-20 @min-[36rem]:size-24 rounded-md bg-bg flex items-center justify-center">
          <Icon name="image" size={28} className="text-ink-3" aria-hidden={false} aria-label={listingText.detail.noPhoto} role="img" />
        </div>
      )}
      <div className="min-w-0 flex flex-col gap-1">
        <button
          type="button"
          onClick={onOpen}
          aria-label={t.detailAria(l.prodName)}
          className="text-left text-[15px] font-bold text-primary hover:underline break-words line-clamp-2"
        >
          {l.prodName}
        </button>
        <p className="text-[13px] text-ink-2 break-words">
          {l.prodBrand}
          {l.prodNo && <span className="num"> · {l.prodNo}</span>}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
          {done ? (
            <span className="inline-flex items-center h-5 px-1.5 rounded-[5px] bg-line-2 text-ink-2 text-[11px] font-semibold">
              {listingText.detail.completedBadge}
            </span>
          ) : (
            <span>{l.prodState}</span>
          )}
          {l.stockQuantity !== null && <span className="tabular-nums">{t.stock(l.stockQuantity.toLocaleString("ko-KR"))}</span>}
          <span className="tabular-nums">{t.reqDeliDate(item.reqDeliDate)}</span>
        </p>
        <p className="text-[12px] text-ink-3">
          <span className="tabular-nums">{t.unitPrice(price)}</span>
          {left !== null && <span className="tabular-nums whitespace-nowrap"> · {t.columns.remaining} {t.remaining(left)}</span>}
        </p>
      </div>
      <div className="col-span-3 @min-[36rem]:col-span-1 flex items-center justify-between @min-[36rem]:flex-col @min-[36rem]:items-end gap-3">
        <span className="inline-flex items-center gap-1.5">
          <button
            type="button"
            className={stepper}
            disabled={quantityBusy || down === null}
            aria-label={t.quantityDown(l.prodName)}
            onClick={() => down !== null && onChangeQuantity(down)}
          >
            {t.quantityDownGlyph}
          </button>
          <span className="num w-10 text-center font-semibold" aria-live="polite">
            {item.orderQuantity.toLocaleString("ko-KR")}
          </span>
          <button
            type="button"
            className={stepper}
            disabled={quantityBusy || up === null}
            aria-label={t.quantityUp(l.prodName)}
            onClick={() => up !== null && onChangeQuantity(up)}
          >
            {t.quantityUpGlyph}
          </button>
        </span>
        <p className="text-right">
          <span className="sr-only">{t.amount}</span>
          <span className="num text-[17px] font-bold text-ink">{formatPrice(cartLineAmount(l.salesUnitPrice, item.orderQuantity))}</span>
          <span className="text-[13px] text-ink-2">{t.won}</span>
        </p>
        <button
          type="button"
          disabled={removing}
          onClick={onRemove}
          aria-label={t.removeOne(l.prodName)}
          className="size-8 inline-flex items-center justify-center rounded-md text-ink-3 hover:bg-bg hover:text-down disabled:opacity-40 disabled:pointer-events-none"
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
