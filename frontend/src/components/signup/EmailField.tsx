"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldShell, statusClass, useFieldStatus } from "@/components/auth/FormField";
import { CUSTOM_DOMAIN, type PersonalSignupInput } from "@/lib/validation/signup";
import { emailDomains, signup as t } from "@/messages/signup";

/** 이메일: 앞부분 @ [도메인 드롭다운]. "직접 입력" 이면 도메인 칸이 열림 */
export function EmailField() {
  const { register, control, resetField, trigger } = useFormContext<PersonalSignupInput>();
  const local = useFieldStatus<PersonalSignupInput>("emailLocal");
  const custom = useFieldStatus<PersonalSignupInput>("emailCustom");
  const isCustom = useWatch({ control, name: "emailDomain" }) === CUSTOM_DOMAIN;
  const error = local.error ?? custom.error;

  return (
    <FieldShell label={t.form.email} htmlFor="emailLocal" error={error}>
      <div className="flex items-center gap-1.5">
        <Input
          id="emailLocal"
          autoComplete="off"
          autoCapitalize="none"
          maxLength={64}
          placeholder={t.form.emailLocalPlaceholder}
          aria-invalid={Boolean(local.error)}
          className={cn(statusClass(local.valid), "min-w-0 flex-1")}
          {...register("emailLocal")}
        />
        <span className="shrink-0 text-ink-3">@</span>
        {isCustom ? (
          <Input
            id="emailCustom"
            autoComplete="off"
            autoCapitalize="none"
            maxLength={190}
            placeholder={t.form.emailDomainPlaceholder}
            aria-invalid={Boolean(custom.error)}
            className={cn(statusClass(custom.valid), "min-w-0 flex-1")}
            {...register("emailCustom")}
          />
        ) : null}
        <Controller
          control={control}
          name="emailDomain"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(v) => {
                field.onChange(v);
                // 도메인을 바꾸면 직접입력 칸의 오류가 남지 않게 비우고, 앞부분은 새 도메인으로 다시 검사
                resetField("emailCustom", { defaultValue: "" });
                void trigger("emailLocal");
              }}
            >
              <SelectTrigger
                aria-label={t.form.email}
                className={cn("h-11 bg-surface text-[15px]", isCustom ? "w-11 px-2 [&>span]:hidden" : "min-w-0 flex-1")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {emailDomains.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_DOMAIN}>{t.form.emailDomainCustom}</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
    </FieldShell>
  );
}
