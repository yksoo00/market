"use client";

import { Controller, useFormContext } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FieldShell } from "@/components/auth/FormField";
import { signup as t } from "@/messages/signup";

const m = t.business.form;

interface CaptchaFields {
  captchaToken: string;
}

/**
 * 자동입력 방지 자리. TODO(Turnstile 키 발급 후): Cloudflare Turnstile 위젯으로 교체하고
 * 위젯이 준 토큰을 captchaToken 에. 지금은 체크박스가 가짜 토큰을 넣는다.
 */
export function CaptchaPlaceholder() {
  const { control } = useFormContext<CaptchaFields>();
  return (
    <FieldShell label={m.captcha}>
      <Controller
        control={control}
        name="captchaToken"
        render={({ field }) => (
          <div className="flex items-center justify-between h-16 px-4 rounded-md border border-line bg-bg">
            <Label htmlFor="captcha" className="gap-2.5 text-[14px] font-normal cursor-pointer">
              <Checkbox id="captcha" checked={field.value !== ""} onCheckedChange={(v) => field.onChange(v === true ? "stub-captcha-token" : "")} />
              {m.captchaLabel}
            </Label>
            <span className="text-[11px] text-ink-3">{m.captchaNote}</span>
          </div>
        )}
      />
    </FieldShell>
  );
}
