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
import { listingsApi } from "@/lib/api/listings";
import { tradesApi } from "@/lib/api/trades";
import { formatPrice } from "@/lib/format";
import { applyServerError } from "@/lib/form";
import { isAuthLost, purchaseBlockReason, type PurchaseBlock } from "@/lib/listingDetail";
import { quoteSchema, type QuoteFormInput, type QuoteFormOutput } from "@/lib/validation/quote";
import { trade } from "@/messages/trade";
import { UNREACHABLE, type ApiFail } from "@/types/api";
import type { ListingDetail } from "@/types/listing";

const t = trade.quote;
const n = (v: number) => v.toLocaleString("ko-KR");

export interface QuoteTarget {
  sellerId: string;
  regDate: string;
}

interface Props {
  /** 1~20개 (부르는 쪽이 개수를 막는다) */
  targets: QuoteTarget[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 요청 성공 — 모달은 이미 닫혔다. 부모가 결과 안내를 띄운다 */
  onRequested: () => void;
}

/**
 * 견적 요청 모달 (스펙 2026-10-20 "화면"). 검색 결과(여러 매물)·상세(한 매물)가 같이 쓴다.
 * 열 때마다 매물을 다시 읽는다 — 검색 결과엔 최소주문량·주문단위가 없고, 등록단가·재고는 최신이어야 해서.
 */
export function QuoteDialog({ targets, open, onOpenChange, onRequested }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 낮은 칸(3분할 아래)에선 여백을 줄이고, 넘치면 모달 안에서 스크롤 (PurchaseDialog 와 같음) */}
      <DialogContent className="max-w-xl flex flex-col gap-4 [@media(max-height:640px)]:gap-3 [@media(max-height:640px)]:p-4">
        <div className="flex flex-col gap-1">
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription className="text-[13px]">{t.desc}</DialogDescription>
        </div>
        {/* 닫으면 내용을 버려 다음에 열 때 새로 읽고, Idempotency-Key 도 새로 만든다 */}
        {open && <QuoteBody targets={targets} onClose={() => onOpenChange(false)} onRequested={onRequested} />}
      </DialogContent>
    </Dialog>
  );
}

type Load =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; details: ListingDetail[]; meId: string | null; anonymous: boolean };

function QuoteBody({ targets, onClose, onRequested }: Omit<Props, "open" | "onOpenChange"> & { onClose: () => void }) {
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
      // 로그인 확인이 인증 만료가 아닌 이유(네트워크 등)로 실패하면 내 매물을 가려낼 수 없다 — 그대로 보내면 서버가 내 매물
      // 하나 때문에 배치 전체를 403 으로 거절하고 어느 줄인지 알려 주지 못하므로 다시 읽게 한다
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
  // [구매]와 같은 이유(내 매물·거래완료·재고 부족)로 보낼 수 없는 매물은 이유만 보이고 뺀다
  const reasons = load.details.map((d) => purchaseBlockReason(d, load.meId));
  const sendable = load.details.filter((_, i) => reasons[i] === null || reasons[i] === "login");
  const skipped = load.details.flatMap((d, i) => {
    const r = reasons[i];
    return r !== null && r !== "login" ? [{ detail: d, reason: r }] : [];
  });
  return <QuoteForm sendable={sendable} skipped={skipped} onClose={onClose} onRequested={onRequested} />;
}

interface FormProps {
  sendable: ListingDetail[];
  skipped: { detail: ListingDetail; reason: Exclude<PurchaseBlock, "login"> }[];
  onClose: () => void;
  onRequested: () => void;
}

/** 서버 fields 키 items[i].칸 → 폼 경로 items.i.칸 */
const toFormPath = (key: string) => key.replace(/\[(\d+)\]/, ".$1");

function QuoteForm({ sendable, skipped, onClose, onRequested }: FormProps) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const form = useForm<QuoteFormInput, unknown, QuoteFormOutput>({
    resolver: zodResolver(
      quoteSchema(
        sendable.map((d) => ({ stock: d.stockQuantity ?? 0, minOrder: d.minOrderQuantity, unit: d.orderUnit, listedPrice: d.salesUnitPrice })),
      ),
    ),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: {
      items: sendable.map((d) => ({ orderUnitPrice: String(d.salesUnitPrice), orderQuantity: String(d.minOrderQuantity), remarks: "" })),
    } as QuoteFormInput,
  });
  const {
    handleSubmit,
    setError,
    formState: { isValid, isSubmitting },
  } = form;
  const [formError, setFormError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  const fieldPaths = sendable.flatMap((_, i) =>
    (["orderUnitPrice", "orderQuantity", "remarks"] as const).map((f) => `items.${i}.${f}` as Path<QuoteFormInput>),
  );

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    setUnreachable(false);
    const result = await tradesApi.createQuotes(
      values.items.map((row, i) => ({
        sellerId: sendable[i].userId,
        regDate: sendable[i].regDate,
        orderUnitPrice: row.orderUnitPrice,
        orderQuantity: row.orderQuantity,
        ...(row.remarks ? { remarks: row.remarks } : {}),
      })),
      idempotencyKey,
    );
    if (result.ok) {
      onClose();
      onRequested();
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
        {sendable.length === 0 && <p className="text-[14px] text-ink">{t.nothingToSend}</p>}
        <ol className="flex flex-col gap-3">
          {sendable.map((d, i) => (
            <li key={`${d.userId}-${d.regDate}`} className="flex flex-col gap-2 rounded-md border border-line p-3">
              <div className="flex flex-col gap-0.5">
                <p className="text-[14px] font-bold text-ink wrap-break-word">{d.prodName}</p>
                <p className="text-[12px] text-ink-2 font-mono tabular-nums">
                  {t.listedPrice} {formatPrice(d.salesUnitPrice)} · {t.stock} {n(d.stockQuantity ?? 0)} ·{" "}
                  {t.rule(n(d.minOrderQuantity), n(d.orderUnit))}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField<QuoteFormInput>
                  name={`items.${i}.orderUnitPrice`}
                  label={t.orderUnitPrice}
                  inputMode="numeric"
                  maxLength={10}
                  className="font-mono tabular-nums"
                />
                <FormField<QuoteFormInput>
                  name={`items.${i}.orderQuantity`}
                  label={t.orderQuantity}
                  inputMode="numeric"
                  maxLength={6}
                  className="font-mono tabular-nums"
                />
              </div>
              <FormField<QuoteFormInput> name={`items.${i}.remarks`} label={t.remarks} placeholder={t.remarksPlaceholder} />
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
