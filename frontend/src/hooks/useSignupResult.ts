"use client";

import { useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import type { ResultDialog } from "@/components/common/ResultDialog";
import { common as tc } from "@/messages/common";
import { signup as t } from "@/messages/signup";

type Result = { tone: "success" } | { tone: "error"; message: string; retry: boolean };

/**
 * 일반·기업 가입의 결과 팝업 상태. 닫을 때 결과를 지우지 않고 open 만 끈다 —
 * 결과를 바로 지우면 닫히는 애니메이션 동안 팝업이 성공 문구로 바뀌어 보인다 (코드리뷰).
 */
export function useSignupResult(kind: "personal" | "business") {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<Result>({ tone: "success" });

  const showSuccess = () => {
    setResult({ tone: "success" });
    setOpen(true);
  };
  const showFailure = (message: string, retry: boolean) => {
    setResult({ tone: "error", message, retry });
    setOpen(true);
  };
  const close = () => setOpen(false);

  const success = kind === "personal" ? { title: t.result.title, message: t.result.message } : { title: t.result.businessTitle, message: t.result.businessMessage };

  /** ResultDialog 에 그대로 펼칠 값. onRetry 는 네트워크 오류일 때만 쓰인다 */
  const dialogProps = (onRetry: () => void): ComponentProps<typeof ResultDialog> =>
    result.tone === "success"
      ? {
          open,
          tone: "success",
          ...success,
          actionLabel: t.result.toLogin,
          // 이 칸 자체를 로그인 화면으로 바꾼다. 타일 칸(iframe)이면 큐가 이 칸을 닫고 로그인 칸으로 정리한다 (paneNavigated)
          onAction: () => router.replace(kind === "personal" ? "/login" : "/login?type=business"),
        }
      : {
          open,
          tone: "error",
          title: t.result.failTitle,
          message: result.message,
          actionLabel: t.result.ok,
          onAction: close,
          onClose: close,
          retryLabel: tc.retry,
          onRetry: result.retry
            ? () => {
                close();
                onRetry();
              }
            : undefined,
        };

  return { showSuccess, showFailure, dialogProps };
}
