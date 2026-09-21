"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { common as t } from "@/messages/common";

/** 폼 상단 오류. 네트워크·5xx 는 onRetry 를 넘겨 "다시 시도" 버튼을 붙인다 */
export function FormError({ message, onRetry }: { message: string | null; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-center gap-3 rounded-md border border-down/30 bg-down/5 px-3 py-2.5 text-[13px] text-down">
      <span className="grow">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
          {t.retry}
        </button>
      )}
    </div>
  );
}

interface SubmitProps {
  label: string;
  /** 필수값 비었거나 오류 있으면 비활성 (rules/frontend.md) */
  disabled: boolean;
  submitting: boolean;
}

export function SubmitButton({ label, disabled, submitting }: SubmitProps) {
  return (
    <Button type="submit" disabled={disabled || submitting} className="h-11 w-full text-[15px] font-bold">
      {submitting ? (
        <>
          <Loader2 className="animate-spin" /> {t.submitting}
        </>
      ) : (
        label
      )}
    </Button>
  );
}
