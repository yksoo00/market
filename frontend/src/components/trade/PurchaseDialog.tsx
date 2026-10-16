"use client";

import { useEffect, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/auth/FormField";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { listingsApi } from "@/lib/api/listings";
import { tradesApi } from "@/lib/api/trades";
import { formatPrice } from "@/lib/format";
import { applyServerError } from "@/lib/form";
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
}

/**
 * 구매요청 모달 (스펙 2026-10-15-purchase-design.md "구매 모달"). 상세·검색 결과가 같이 쓴다.
 * 열 때마다 매물을 다시 읽는다 — 검색 결과엔 최소주문량·주문단위가 없고, 재고는 최신이어야 해서.
 */
export function PurchaseDialog({ sellerId, regDate, open, onOpenChange, onPurchased }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription className="text-[13px]">{t.desc}</DialogDescription>
        </div>
        {/* 닫으면 내용을 버려 다음에 열 때 새로 읽고, Idempotency-Key 도 새로 만든다 */}
        {open && <PurchaseBody sellerId={sellerId} regDate={regDate} onClose={() => onOpenChange(false)} onPurchased={onPurchased} />}
      </DialogContent>
    </Dialog>
  );
}

type Load = { kind: "loading" } | { kind: "error" } | { kind: "ready"; detail: ListingDetail; version: number };

function PurchaseBody({ sellerId, regDate, onClose, onPurchased }: Omit<Props, "open" | "onOpenChange"> & { onClose: () => void }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [notice, setNotice] = useState<string | null>(null);
  // 올리면 다시 읽는다 (다시 시도·재고 부족 뒤)
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    void listingsApi.get(sellerId, regDate).then((res) => {
      if (!alive) return;
      setLoad((prev) =>
        res.ok ? { kind: "ready", detail: res.data, version: prev.kind === "ready" ? prev.version + 1 : 0 } : { kind: "error" },
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
  return (
    <PurchaseForm
      // 재고 부족(409)으로 다시 읽으면 새 재고 기준의 검증으로 폼을 새로 만든다
      key={load.version}
      detail={load.detail}
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
  notice: string | null;
  onStockChanged: () => void;
  onClose: () => void;
  onPurchased: (created: Trade) => void;
}

function PurchaseForm({ detail, notice, onStockChanged, onClose, onPurchased }: FormProps) {
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
    defaultValues: { orderQuantity: String(detail.minOrderQuantity), reqDeliDate: detail.deliveryDate ?? "", remarks: "" },
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
    const result = await tradesApi.create(
      {
        sellerId: detail.userId,
        regDate: detail.regDate,
        orderQuantity: values.orderQuantity,
        ...(values.reqDeliDate ? { reqDeliDate: values.reqDeliDate } : {}),
        ...(values.remarks ? { remarks: values.remarks } : {}),
      },
      idempotencyKey,
    );
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
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
        {notice && (
          <p role="status" className="text-[13px] text-ink-2">
            {notice}
          </p>
        )}
        <FormError message={formError} onRetry={unreachable && !isSubmitting ? () => void submit() : undefined} />
        <div className="flex flex-col gap-0.5">
          <p className="text-[15px] font-bold text-ink wrap-break-word">{detail.prodName}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px]">
            {info.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-ink-3">{label}</dt>
                <dd className="text-ink font-mono tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <FormField<PurchaseFormInput> name="orderQuantity" label={t.orderQuantity} inputMode="numeric" maxLength={6} className="font-mono tabular-nums" />
        <FormField<PurchaseFormInput>
          name="reqDeliDate"
          label={t.reqDeliDate}
          hint={detail.deliveryDate ? t.reqDeliDateHint : undefined}
          type="date"
          min={today}
        />
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
