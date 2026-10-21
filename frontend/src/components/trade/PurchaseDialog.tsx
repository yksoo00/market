"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/auth/FormField";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { authApi } from "@/lib/api/auth";
import { listingsApi } from "@/lib/api/listings";
import { tradesApi } from "@/lib/api/trades";
import { formatPrice } from "@/lib/format";
import { applyServerError } from "@/lib/form";
import { isAuthLost, purchaseBlockReason } from "@/lib/listingDetail";
import { todayInSeoul } from "@/lib/listingForm";
import { isInt } from "@/lib/validation/listing";
import { orderAmount, purchaseSchema, type PurchaseFormInput, type PurchaseFormOutput } from "@/lib/validation/trade";
import { trade } from "@/messages/trade";
import { UNREACHABLE } from "@/types/api";
import type { ListingDetail } from "@/types/listing";
import type { Trade } from "@/types/trade";

const t = trade.purchase;
const FIELDS = ["orderQuantity", "reqDeliDate", "remarks"] as const;

interface Props {
  sellerId: string;
  regDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 요청 성공 — 모달은 이미 닫혔다. 부모가 결과 안내를 띄운다 */
  onPurchased: (created: Trade) => void;
  /** 수락된 견적에서 [구매]: 그 거래ID. 있으면 새 거래를 만들지 않고 그 견적이 구매요청이 된다 (견적서 한 건 = 한 행) */
  quoteTradeId?: string;
  /** 견적에서 연 모달의 주문량 기본값(견적 수량). 없으면 최소주문량 */
  defaultQuantity?: number;
}

/**
 * 구매요청 모달 (스펙 2026-10-15-purchase-design.md "구매 모달"). 상세·검색 결과가 같이 쓴다.
 * 열 때마다 매물을 다시 읽는다 — 검색 결과엔 최소주문량·주문단위가 없고, 재고는 최신이어야 해서.
 */
export function PurchaseDialog({ sellerId, regDate, open, onOpenChange, onPurchased, quoteTradeId, defaultQuantity }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 3분할 아래 칸(iframe)은 창 높이의 절반도 안 된다 — 낮은 칸에선 여백을 줄이고, 그래도 넘치면 모달 안에서 스크롤 (dialog.tsx max-h) */}
      <DialogContent className="max-w-md flex flex-col gap-4 [@media(max-height:640px)]:gap-3 [@media(max-height:640px)]:p-4">
        <div className="flex flex-col gap-1">
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription className="text-[13px]">{t.desc}</DialogDescription>
        </div>
        {/* 닫으면 내용을 버려 다음에 열 때 새로 읽고, Idempotency-Key 도 새로 만든다 */}
        {open && (
          <PurchaseBody
            sellerId={sellerId}
            regDate={regDate}
            quoteTradeId={quoteTradeId}
            defaultQuantity={defaultQuantity}
            onClose={() => onOpenChange(false)}
            onPurchased={onPurchased}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type Load =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; detail: ListingDetail; meId: string | null; anonymous: boolean; version: number };

function PurchaseBody({ sellerId, regDate, quoteTradeId, defaultQuantity, onClose, onPurchased }: Omit<Props, "open" | "onOpenChange"> & { onClose: () => void }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const pathname = usePathname();
  const [notice, setNotice] = useState<string | null>(null);
  // 올리면 다시 읽는다 (다시 시도·재고 부족 뒤)
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    // 로그인 사용자도 함께 — 검색 결과에서 열면 상세처럼 미리 막을 정보(내 매물·비로그인)가 없어서
    void Promise.all([listingsApi.get(sellerId, regDate), authApi.me()]).then(([res, me]) => {
      if (!alive) return;
      setLoad((prev) =>
        res.ok
          ? {
              kind: "ready",
              detail: res.data,
              meId: me.ok ? me.data.id : null,
              anonymous: !me.ok && isAuthLost(me.code),
              version: prev.kind === "ready" ? prev.version + 1 : 0,
            }
          : { kind: "error" },
      );
    });
    return () => {
      alive = false;
    };
  }, [sellerId, regDate, attempt]);

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
            setAttempt((n) => n + 1);
          }}
          className="h-8.5 px-4 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft"
        >
          {t.retry}
        </button>
      </div>
    );
  }
  // 상세의 [구매] 버튼과 같은 규칙(purchaseBlockReason). 로그인 여부를 모르면(확인 실패) 폼을 열고 서버 401 에 맡긴다
  const block = purchaseBlockReason(load.detail, load.meId);
  if (block === "login" && load.anonymous) {
    return (
      <div className="py-4 flex flex-col items-center gap-3 text-center">
        <p className="text-[14px] text-ink">{t.loginRequired}</p>
        <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="h-9 px-5 inline-flex items-center rounded-md bg-primary text-white text-sm font-bold">
          {t.toLogin}
        </Link>
      </div>
    );
  }
  if (block !== null && block !== "login") {
    return (
      <div className="py-4 flex flex-col items-center gap-3 text-center">
        <p role="alert" className="text-[14px] text-ink">
          {t.blocked[block]}
        </p>
        <button type="button" onClick={onClose} className="h-9 px-5 rounded-md border border-line text-sm font-medium text-ink-2 hover:bg-bg">
          {t.cancel}
        </button>
      </div>
    );
  }
  return (
    <PurchaseForm
      // 재고 부족(409)으로 다시 읽으면 새 재고 기준의 검증으로 폼을 새로 만든다
      key={load.version}
      detail={load.detail}
      quoteTradeId={quoteTradeId}
      defaultQuantity={defaultQuantity}
      notice={notice}
      onStockChanged={() => {
        setNotice(t.stockRefreshed);
        setAttempt((n) => n + 1);
      }}
      onClose={onClose}
      onPurchased={onPurchased}
    />
  );
}

interface FormProps {
  detail: ListingDetail;
  quoteTradeId?: string;
  defaultQuantity?: number;
  notice: string | null;
  onStockChanged: () => void;
  onClose: () => void;
  onPurchased: (created: Trade) => void;
}

function PurchaseForm({ detail, quoteTradeId, defaultQuantity, notice, onStockChanged, onClose, onPurchased }: FormProps) {
  // 날짜 기준·중복 방지 키는 폼을 연 동안 고정
  const [today] = useState(() => todayInSeoul());
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const form = useForm<PurchaseFormInput, unknown, PurchaseFormOutput>({
    resolver: zodResolver(
      purchaseSchema({
        stock: detail.stockQuantity ?? 0,
        minOrder: detail.minOrderQuantity,
        unit: detail.orderUnit,
        unitPrice: detail.salesUnitPrice,
        provDate: detail.deliveryDate,
        today,
      }),
    ),
    mode: "onTouched",
    reValidateMode: "onChange",
    defaultValues: { orderQuantity: String(defaultQuantity ?? detail.minOrderQuantity), reqDeliDate: detail.deliveryDate ?? "", remarks: "" },
  });
  const {
    control,
    handleSubmit,
    setError,
    formState: { isValid, isSubmitting },
  } = form;
  const [formError, setFormError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const quantity = useWatch({ control, name: "orderQuantity" });
  const amount = isInt(quantity) ? orderAmount(detail.salesUnitPrice, Number(quantity)) : null;

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    setUnreachable(false);
    const fields = {
      orderQuantity: values.orderQuantity,
      ...(values.reqDeliDate ? { reqDeliDate: values.reqDeliDate } : {}),
      ...(values.remarks ? { remarks: values.remarks } : {}),
    };
    const result = quoteTradeId
      ? await tradesApi.purchaseQuote(quoteTradeId, fields)
      : await tradesApi.create({ sellerId: detail.userId, regDate: detail.regDate, ...fields }, idempotencyKey);
    if (result.ok) {
      onClose();
      onPurchased(result.data);
      return;
    }
    if (result.code === "TRADE_OUT_OF_STOCK") {
      onStockChanged();
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    setFormError(applyServerError(result, setError, FIELDS, trade.errors));
  });

  const info: [string, string][] = [
    [t.unitPrice, formatPrice(detail.salesUnitPrice)],
    [t.stock, t.count(detail.stockQuantity ?? 0)],
    [t.minOrder, t.count(detail.minOrderQuantity)],
    [t.unit, t.count(detail.orderUnit)],
    [t.provDate, detail.deliveryDate ?? t.none],
  ];

  return (
    <FormProvider {...form}>
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4 [@media(max-height:640px)]:gap-3">
        {notice && (
          <p role="status" className="text-[13px] text-ink-2">
            {notice}
          </p>
        )}
        <FormError message={formError} onRetry={unreachable && !isSubmitting ? () => void submit() : undefined} />
        <div className="flex flex-col gap-0.5">
          <p className="text-[15px] font-bold text-ink wrap-break-word">{detail.prodName}</p>
          {/* 폭이 되면 2열(라벨·값 ×2) — 세로 5줄을 3줄로 줄여 낮은 칸에서도 입력 칸이 보이게 */}
          <dl className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-0.5 text-[13px]">
            {info.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-ink-3">{label}</dt>
                <dd className="text-ink font-mono tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 [@media(max-height:640px)]:gap-3">
          <FormField<PurchaseFormInput> name="orderQuantity" label={t.orderQuantity} inputMode="numeric" maxLength={6} className="font-mono tabular-nums" />
          <FormField<PurchaseFormInput>
            name="reqDeliDate"
            label={t.reqDeliDate}
            hint={detail.deliveryDate ? t.reqDeliDateHint : undefined}
            type="date"
            min={today}
          />
        </div>
        <FormField<PurchaseFormInput> name="remarks" label={t.remarks} placeholder={t.remarksPlaceholder} />
        <p className="flex items-baseline justify-between text-[14px]">
          <span className="text-ink-2">{t.amount}</span>
          <span className="font-bold font-mono tabular-nums text-ink" aria-live="polite">
            {amount === null ? "-" : formatPrice(amount)}
          </span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-md border border-line text-[15px] font-medium text-ink-2 hover:bg-bg"
          >
            {t.cancel}
          </button>
          <div className="flex-1">
            <SubmitButton label={t.submit} disabled={!isValid} submitting={isSubmitting} />
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
