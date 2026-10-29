"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FormProvider, useForm, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/auth/FormField";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { authApi } from "@/lib/api/auth";
import { cartApi } from "@/lib/api/cart";
import { listingsApi } from "@/lib/api/listings";
import { formatPrice } from "@/lib/format";
import { applyServerError } from "@/lib/form";
import { isAuthLost, isOwner } from "@/lib/listingDetail";
import { todayInSeoul } from "@/lib/listingForm";
import { cartAddSchema, type CartAddFormInput, type CartAddFormOutput } from "@/lib/validation/cartAdd";
import { cart } from "@/messages/cart";
import { trade } from "@/messages/trade";
import { UNREACHABLE, type ApiFail } from "@/types/api";
import type { CartAddResult } from "@/types/cart";
import type { ListingDetail } from "@/types/listing";

const t = cart.add.dialog;
const n = (v: number) => v.toLocaleString("ko-KR");

export interface CartTarget {
  sellerId: string;
  regDate: string;
}

interface Props {
  /** 1~20개 (부르는 쪽이 개수를 막는다) */
  targets: CartTarget[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 담기 성공 — 모달은 이미 닫혔다. 부모가 결과 안내를 띄운다 */
  onAdded: (result: CartAddResult) => void;
}

/**
 * 장바구니 담기 모달 (설계 2026-10-27 PR 3). 매물마다 수량·납품희망일(기본 제공가능일)·요청사항을 받는다 — 견적 모달과 같은 모양, 단가 칸 없음.
 * 검색 목록(여러 매물)·상세(한 매물)가 같이 쓴다. 열 때마다 매물을 다시 읽는다 — 검색 결과엔 최소주문량·주문단위가 없어서.
 */
export function CartDialog({ targets, open, onOpenChange, onAdded }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 낮은 칸(3분할 아래)에선 여백을 줄이고, 넘치면 모달 안에서 스크롤 (QuoteDialog 와 같음) */}
      <DialogContent className="max-w-xl flex flex-col gap-4 [@media(max-height:640px)]:gap-3 [@media(max-height:640px)]:p-4">
        <div className="flex flex-col gap-1">
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription className="text-[13px]">{t.desc}</DialogDescription>
        </div>
        {open && <CartBody targets={targets} onClose={() => onOpenChange(false)} onAdded={onAdded} />}
      </DialogContent>
    </Dialog>
  );
}

type Load =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; details: ListingDetail[]; meId: string | null; anonymous: boolean };

function CartBody({ targets, onClose, onAdded }: Omit<Props, "open" | "onOpenChange"> & { onClose: () => void }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const pathname = usePathname();
  // 부모가 다시 그릴 때마다 새 배열을 넘겨도 같은 매물이면 다시 읽지 않게 (입력 중인 폼이 초기화되지 않게)
  const targetsKey = targets.map((x) => `${x.sellerId}/${x.regDate}`).join(",");

  useEffect(() => {
    let alive = true;
    void Promise.all([Promise.all(targets.map((x) => listingsApi.get(x.sellerId, x.regDate))), authApi.me()]).then(([results, me]) => {
      if (!alive) return;
      const details = results.flatMap((r) => (r.ok ? [r.data] : []));
      // 로그인 확인이 인증 만료가 아닌 이유(네트워크 등)로 실패하면 내 매물을 가려낼 수 없다 — 다시 읽게 한다 (QuoteDialog 와 같은 이유)
      const meUnknown = !me.ok && !isAuthLost(me.code);
      setLoad(
        details.length === results.length && !meUnknown
          ? { kind: "ready", details, meId: me.ok ? me.data.id : null, anonymous: !me.ok }
          : { kind: "error" },
      );
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- targets 는 targetsKey 로 비교한다
  }, [targetsKey, attempt]);

  if (load.kind === "loading") {
    return (
      <p className="py-8 text-center text-[13px] text-ink-2" aria-busy="true">
        {t.loading}
      </p>
    );
  }
  if (load.kind === "error") {
    return (
      <div className="py-6 flex flex-col items-center gap-3">
        <p className="text-[14px] text-ink">{t.loadFailed}</p>
        <button
          type="button"
          onClick={() => {
            setLoad({ kind: "loading" });
            setAttempt((k) => k + 1);
          }}
          className="h-8.5 px-4 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft"
        >
          {t.retry}
        </button>
      </div>
    );
  }
  if (load.anonymous) {
    return (
      <div className="py-4 flex flex-col items-center gap-3 text-center">
        <p className="text-[14px] text-ink">{t.loginRequired}</p>
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="h-9 px-5 inline-flex items-center rounded-md bg-primary text-white text-sm font-bold">
          {t.toLogin}
        </Link>
      </div>
    );
  }
  // 서버가 거절하는 매물(내 매물·거래완료)은 이유만 보이고 뺀다. 재고는 안 본다 — 재고가 모자라도 담아 둔다
  const reasonOf = (d: ListingDetail): "own" | "completed" | null =>
    isOwner(load.meId, d.userId) ? "own" : d.tradeStatus === "completed" ? "completed" : null;
  const sendable = load.details.filter((d) => reasonOf(d) === null);
  const skipped = load.details.flatMap((d) => {
    const r = reasonOf(d);
    return r ? [{ detail: d, reason: r }] : [];
  });
  return <CartForm sendable={sendable} skipped={skipped} onClose={onClose} onAdded={onAdded} />;
}

interface FormProps {
  sendable: ListingDetail[];
  skipped: { detail: ListingDetail; reason: "own" | "completed" }[];
  onClose: () => void;
  onAdded: (result: CartAddResult) => void;
}

/** 서버 fields 키 items[i].칸 → 폼 경로 items.i.칸 */
const toFormPath = (key: string) => key.replace(/\[(\d+)\]/, ".$1");

function CartForm({ sendable, skipped, onClose, onAdded }: FormProps) {
  // 날짜 기준은 폼을 연 동안 고정 (견적·구매 모달과 같음)
  const [today] = useState(() => todayInSeoul());
  const form = useForm<CartAddFormInput, unknown, CartAddFormOutput>({
    resolver: zodResolver(
      cartAddSchema(sendable.map((d) => ({ minOrder: d.minOrderQuantity, unit: d.orderUnit, unitPrice: d.salesUnitPrice, today }))),
    ),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      // 수량 기본값은 최소주문량, 납품희망일 기본값은 매물 제공가능일 — 바꿀 수 있다
      items: sendable.map((d) => ({ orderQuantity: String(d.minOrderQuantity), reqDeliDate: d.deliveryDate ?? "", remarks: "" })),
    } as CartAddFormInput,
  });
  const {
    handleSubmit,
    setError,
    formState: { isValid, isSubmitting },
  } = form;
  const [formError, setFormError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const fieldPaths = sendable.flatMap((_, i) =>
    (["orderQuantity", "reqDeliDate", "remarks"] as const).map((f) => `items.${i}.${f}` as Path<CartAddFormInput>),
  );

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    setUnreachable(false);
    const result = await cartApi.add(
      values.items.map((row, i) => ({
        sellerId: sendable[i].userId,
        regDate: sendable[i].regDate,
        orderQuantity: row.orderQuantity,
        reqDeliDate: row.reqDeliDate,
        ...(row.remarks ? { remarks: row.remarks } : {}),
      })),
    );
    if (result.ok) {
      onClose();
      onAdded(result.data);
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    const fail: ApiFail = result.fields
      ? { ...result, fields: Object.fromEntries(Object.entries(result.fields).map(([k, m]) => [toFormPath(k), m])) }
      : result;
    setFormError(applyServerError(fail, setError, fieldPaths, trade.errors));
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4 [@media(max-height:640px)]:gap-3">
        <FormError message={formError} onRetry={unreachable && !isSubmitting ? () => void submit() : undefined} />
        {sendable.length === 0 && <p className="text-[14px] text-ink">{t.nothingToAdd}</p>}
        <ol className="flex flex-col gap-3">
          {sendable.map((d, i) => (
            <li key={`${d.userId}-${d.regDate}`} className="flex flex-col gap-2 rounded-md border border-line p-3">
              <div className="flex flex-col gap-0.5">
                <p className="text-[14px] font-bold text-ink wrap-break-word">{d.prodName}</p>
                <p className="text-[12px] text-ink-2 font-mono tabular-nums">
                  {t.unitPrice} {formatPrice(d.salesUnitPrice)} · {t.stock} {n(d.stockQuantity ?? 0)} ·{" "}
                  {t.rule(n(d.minOrderQuantity), n(d.orderUnit))}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField<CartAddFormInput>
                  name={`items.${i}.orderQuantity`}
                  label={t.orderQuantity}
                  inputMode="numeric"
                  maxLength={6}
                  className="font-mono tabular-nums"
                />
                <FormField<CartAddFormInput> name={`items.${i}.reqDeliDate`} label={t.reqDeliDate} type="date" min={today} />
              </div>
              <FormField<CartAddFormInput> name={`items.${i}.remarks`} label={t.remarks} placeholder={t.remarksPlaceholder} />
            </li>
          ))}
        </ol>
        {skipped.length > 0 && (
          <div className="flex flex-col gap-1 text-[13px] text-ink-2">
            <p className="font-medium">{t.skipped}</p>
            <ul className="flex flex-col gap-0.5">
              {skipped.map(({ detail, reason }) => (
                <li key={`${detail.userId}-${detail.regDate}`}>
                  {detail.prodName} — {t.blocked[reason]}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-md border border-line text-[15px] font-medium text-ink-2 hover:bg-bg">
            {t.cancel}
          </button>
          {sendable.length > 0 && (
            <div className="flex-1">
              <SubmitButton label={t.submit(sendable.length)} disabled={!isValid} submitting={isSubmitting} />
            </div>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
