"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buyBulk } from "@/messages/buyBulk";
import type { BuyLine } from "@/lib/buyBulk";
import type { ListingOption } from "@/types/cartBulk";

const t = buyBulk.option;

interface Props {
  line: BuyLine;
  onChoose: (sellerId: string, regDate: string) => void;
  onClose: () => void;
}

/** 살 수 있는 매물이 먼저(단가 낮은 순), 못 사는 매물은 뒤에 사유와 함께 */
const ordered = (options: ListingOption[]): ListingOption[] =>
  [...options].sort((a, b) => (a.reason === null ? 0 : 1) - (b.reason === null ? 0 : 1) || a.unitPrice - b.unitPrice || a.regDate.localeCompare(b.regDate));

/**
 * 다른 매물 보기 (계획 2026-11-09-bulk-purchase-excel.md). 그 줄 상품의 모든 매물과 대체품 제안의 매물을 보여 주고 하나를 고른다.
 * 못 사는 매물은 빼지 않고 회색 + 사유로 보여 준다(왜 안 되는지 알게). 대체품 매물을 고르면 서버가 대체품으로 판단해 요청사항에 "원래 요청"이 붙는다
 */
export function ListingOptionDialog({ line, onChoose, onClose }: Props) {
  const name = line.result.matchedName ?? line.fields.prodName;
  const chosenKey = line.result.chosen ? `${line.result.chosen.sellerId}/${line.result.chosen.regDate}` : null;
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl flex flex-col gap-3 [@media(max-height:640px)]:gap-2 [@media(max-height:640px)]:p-4">
        <div className="flex flex-col gap-1">
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription className="text-[13px]">{t.desc}</DialogDescription>
        </div>
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
          <OptionList title={t.main(name)} options={line.result.options} chosenKey={chosenKey} onChoose={onChoose} emptyText={t.empty} />
          {line.result.alternatives.map((alt) => (
            <OptionList
              key={alt.prodId}
              title={t.alternative(alt.prodName)}
              note={t.alternativeNote}
              options={alt.options}
              chosenKey={chosenKey}
              onChoose={onChoose}
              emptyText={t.empty}
            />
          ))}
        </div>
        <button type="button" onClick={onClose} className="h-10 rounded-md border border-line text-[14px] font-medium text-ink-2 hover:bg-bg">
          {t.cancel}
        </button>
      </DialogContent>
    </Dialog>
  );
}

function OptionList({
  title,
  note,
  options,
  chosenKey,
  onChoose,
  emptyText,
}: {
  title: string;
  note?: string;
  options: ListingOption[];
  chosenKey: string | null;
  onChoose: (sellerId: string, regDate: string) => void;
  emptyText: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[14px] font-bold text-ink">{title}</h3>
      {note && <p className="text-[12px] text-ink-2">{note}</p>}
      {options.length === 0 ? (
        <p className="rounded-md border border-line py-4 text-center text-[13px] text-ink-2">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {ordered(options).map((o) => {
            const key = `${o.sellerId}/${o.regDate}`;
            const blocked = o.reason !== null;
            return (
              <li key={key}>
                <button
                  type="button"
                  disabled={blocked}
                  aria-pressed={key === chosenKey}
                  onClick={() => onChoose(o.sellerId, o.regDate)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-md border px-3 py-2 text-left",
                    key === chosenKey ? "border-primary bg-primary-soft" : "border-line",
                    blocked ? "cursor-not-allowed bg-bg text-ink-3" : "hover:bg-bg",
                  )}
                >
                  <span className="flex flex-wrap items-baseline gap-x-3 text-[13px]">
                    <span className="font-semibold">{buyBulk.line.seller(o.sellerNickname)}</span>
                    <span className="num">{buyBulk.line.price(formatPrice(o.unitPrice))}</span>
                    <span className="num">{buyBulk.line.stock(o.stock)}</span>
                    {o.deliveryDate && <span className="num">{buyBulk.line.delivery(o.deliveryDate)}</span>}
                  </span>
                  <span className="num text-[12px] text-ink-3">{t.minOrder(o.minOrder, o.orderUnit)}</span>
                  {o.replaceHint && <span className="text-[12px] text-ink-3">{t.replaceHint(o.replaceHint)}</span>}
                  {o.reason && <span className="text-[12px] text-down">{o.reason}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
