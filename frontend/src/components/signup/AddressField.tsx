"use client";

import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { X } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldShell, statusClass, useFieldStatus, type Inline } from "@/components/auth/FormField";
import { loadPostcode, pickAddress } from "@/lib/postcode";
import { signup as t } from "@/messages/signup";

/** 이 컴포넌트를 쓰는 폼이 가져야 하는 칸. 일반·기업 가입 공용 (제출 때 joinAddress 로 합친다) */
export interface AddressFields {
  address: string;
  addressDetail: string;
}

interface Props {
  label: string;
  placeholder?: string;
  inline?: Inline;
}

/**
 * 주소: [기본 주소][주소 찾기] + 상세주소. 검색 창은 새 창(팝업) 대신 칸 아래 레이어에 띄운다 —
 * 스크립트를 불러온 뒤 여는 창은 브라우저가 팝업으로 막고, 타일 칸(iframe) 안에서도 그대로 보이게.
 * 검색이 안 될 때도 가입은 되도록 기본 주소는 직접 입력도 받는다.
 */
export function AddressField({ label, placeholder, inline }: Props) {
  const { register, setValue, setFocus } = useFormContext<AddressFields>();
  const base = useFieldStatus<AddressFields>("address");
  const detail = useFieldStatus<AddressFields>("addressDetail");
  const [open, setOpen] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    loadPostcode()
      .then((daum) => {
        if (!active || !layerRef.current) return;
        new daum.Postcode({
          width: "100%",
          height: "100%",
          oncomplete: (data) => {
            setValue("address", pickAddress(data), { shouldValidate: true, shouldDirty: true, shouldTouch: true });
            setOpen(false);
            // 고른 다음 바로 동·호수를 치게
            setTimeout(() => setFocus("addressDetail"), 0);
          },
        }).embed(layerRef.current);
      })
      .catch(() => {
        if (!active) return;
        setLoadFailed(true);
        setOpen(false);
      });
    return () => {
      active = false;
    };
  }, [open, setValue, setFocus]);

  return (
    <FieldShell label={label} htmlFor="address" error={base.error ?? detail.error ?? (loadFailed ? t.address.loadFailed : undefined)} inline={inline}>
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <Input
            id="address"
            autoComplete="street-address"
            maxLength={200}
            placeholder={placeholder}
            aria-invalid={Boolean(base.error)}
            className={cn(statusClass(base.valid), "min-w-0 grow")}
            {...register("address")}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLoadFailed(false);
              setOpen((o) => !o);
            }}
            aria-expanded={open}
            className="h-11 shrink-0 px-3.5 text-[13px] font-semibold border-primary text-primary hover:bg-primary-soft hover:text-primary-dark"
          >
            {t.address.search}
          </Button>
        </div>
        {open && (
          <div className="relative h-[400px] overflow-hidden rounded-md border border-line">
            <div ref={layerRef} className="h-full w-full" />
            <button
              type="button"
              aria-label={t.terms.hide}
              onClick={() => setOpen(false)}
              className="absolute top-1 right-1 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-surface border border-line hover:border-primary"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <Input
          id="addressDetail"
          aria-label={t.address.detail}
          maxLength={100}
          placeholder={t.address.detailPlaceholder}
          aria-invalid={Boolean(detail.error)}
          className={statusClass(detail.valid)}
          {...register("addressDetail")}
        />
      </div>
    </FieldShell>
  );
}
