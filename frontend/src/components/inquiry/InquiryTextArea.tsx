"use client";

import { useId } from "react";
import { useFormContext, type FieldValues, type Path } from "react-hook-form";
import { cn } from "cn";
import { FieldShell, useFieldStatus } from "@/components/auth/FormField";

interface Props<T extends FieldValues> {
  name: Path<T>;
  label: string;
  placeholder: string;
  rows: number;
}

/** 라벨 + 여러 줄 입력 + 오류 문구. FormField(한 줄)와 같은 상태 표시 규칙(blur 후 오류, 입력 중 즉시 해소) */
export function InquiryTextArea<T extends FieldValues>({ name, label, placeholder, rows }: Props<T>) {
  const { register } = useFormContext<T>();
  const { error, valid, touched } = useFieldStatus<T>(name);
  // 한 화면에 이 입력이 여러 개(글 수정·답글 수정·새 답글)일 수 있어 id 를 겹치지 않게 만든다
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} error={error}>
      <textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={touched && Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "w-full min-w-0 resize-y rounded-lg border border-input bg-surface px-3 py-2 text-[15px] outline-none placeholder:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
          valid && "border-up focus-visible:border-up focus-visible:ring-up/30",
        )}
        {...register(name)}
      />
    </FieldShell>
  );
}
