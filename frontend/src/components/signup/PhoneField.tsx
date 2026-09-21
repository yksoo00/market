"use client";

import { useRef, type ChangeEvent } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldShell, statusClass, useFieldStatus } from "@/components/auth/FormField";
import type { PersonalSignupInput } from "@/lib/validation/signup";
import { phonePrefixes, signup as t } from "@/messages/signup";

/** 휴대폰: [010 ▾] - 1234 - 5678. 숫자만 받고 4자리 차면 다음 칸으로 */
export function PhoneField() {
  const { register, control } = useFormContext<PersonalSignupInput>();
  const mid = useFieldStatus<PersonalSignupInput>("phoneMid");
  const last = useFieldStatus<PersonalSignupInput>("phoneLast");
  const lastRef = useRef<HTMLInputElement | null>(null);
  const midReg = register("phoneMid");
  const lastReg = register("phoneLast");

  function digitsOnly(e: ChangeEvent<HTMLInputElement>) {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
  }

  return (
    <FieldShell label={t.form.phone} htmlFor="phoneMid" error={mid.error ?? last.error}>
      <div className="flex items-center gap-1.5">
        <Controller
          control={control}
          name="phonePrefix"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-label={t.form.phone} className="h-11 w-24 shrink-0 bg-surface num text-[15px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {phonePrefixes.map((p) => (
                  <SelectItem key={p} value={p} className="num">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <span className="text-ink-3">-</span>
        <Input
          id="phoneMid"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={4}
          aria-invalid={Boolean(mid.error)}
          className={cn(statusClass(mid.valid), "num min-w-0 flex-1 text-center")}
          {...midReg}
          onChange={(e) => {
            digitsOnly(e);
            void midReg.onChange(e);
            if (e.target.value.length === 4) lastRef.current?.focus();
          }}
        />
        <span className="text-ink-3">-</span>
        <Input
          id="phoneLast"
          inputMode="numeric"
          maxLength={4}
          aria-invalid={Boolean(last.error)}
          className={cn(statusClass(last.valid), "num min-w-0 flex-1 text-center")}
          {...lastReg}
          ref={(el) => {
            lastReg.ref(el);
            lastRef.current = el;
          }}
          onChange={(e) => {
            digitsOnly(e);
            void lastReg.onChange(e);
          }}
        />
      </div>
    </FieldShell>
  );
}
