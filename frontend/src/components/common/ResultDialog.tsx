"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  tone: "success" | "error";
  title: string;
  message: string;
  /** 주 버튼 (성공: 로그인으로, 실패: 확인) */
  actionLabel: string;
  onAction: () => void;
  /** 닫기(바깥 클릭·Esc). 성공 팝업처럼 꼭 주 버튼으로만 넘어가야 하면 생략 */
  onClose?: () => void;
  /** 네트워크 오류 등 다시 보낼 수 있을 때 (rules/frontend.md "네트워크·5xx 는 재시도") */
  retryLabel?: string;
  onRetry?: () => void;
}

/** 요청 결과 팝업 (design.md "결과 팝업"). 브라우저 alert 대신 화면 모양에 맞춘 것 */
export function ResultDialog({ open, tone, title, message, actionLabel, onAction, onClose, retryLabel, onRetry }: Props) {
  const Icon = tone === "success" ? CheckCircle2 : CircleAlert;
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent
        role={tone === "error" ? "alertdialog" : "dialog"}
        onEscapeKeyDown={(e) => !onClose && e.preventDefault()}
        onPointerDownOutside={(e) => !onClose && e.preventDefault()}
        className="flex flex-col items-center gap-3 text-center"
      >
        <Icon size={44} className={tone === "success" ? "text-up" : "text-down"} aria-hidden="true" />
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="whitespace-pre-line">{message}</DialogDescription>
        <div className="mt-2 flex w-full gap-2">
          {onRetry && retryLabel && (
            <Button type="button" variant="outline" onClick={onRetry} className="h-11 flex-1 text-[15px] font-bold">
              {retryLabel}
            </Button>
          )}
          <Button type="button" onClick={onAction} autoFocus className="h-11 flex-1 text-[15px] font-bold">
            {actionLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
