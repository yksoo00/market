"use client";

import { useState, type ComponentProps } from "react";
import { useFormContext, useWatch, type FieldValues, type Path } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth as t } from "@/messages/auth";

interface Props<T extends FieldValues> extends Omit<ComponentProps<"input">, "name" | "form"> {
  name: Path<T>;
  label: string;
  /** 라벨 오른쪽에 붙는 안내 (예: "변경 불가") */
  hint?: string;
}

/**
 * 라벨 + 입력 + 오류 문구. FormProvider 안에서만 사용.
 * 상태 테두리(design.md "폼 페이지"): blur 전엔 기본, blur 후 오류면 down, 통과면 up.
 * 입력 중 고쳐지면 즉시 반영 (useForm 의 reValidateMode: "onChange").
 */
export function FormField<T extends FieldValues>({ name, label, hint, className, type, ...rest }: Props<T>) {
  const { register, control, getFieldState, formState } = useFormContext<T>();
  const [show, setShow] = useState(false);

  const state = getFieldState(name, formState);
  const error = state.error?.message;
  // 버튼 비활성으로 보통 못 오지만, 제출을 시도했다면 blur 안 한 칸도 오류를 보여준다
  const touched = state.isTouched || formState.isSubmitted;
  const value = useWatch({ control, name }) as unknown;
  const valid = touched && !error && value !== "" && value !== undefined;
  const isPassword = type === "password";
  const errorId = `${name}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name} className="text-[13px] text-ink-2">
        {label}
        {hint && <span className="font-normal text-ink-3">{hint}</span>}
      </Label>
      <div className="relative">
        <Input
          id={name}
          type={isPassword && show ? "text" : type}
          aria-invalid={touched && Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "h-11 px-3 text-[15px] bg-surface",
            valid && "border-up focus-visible:border-up focus-visible:ring-up/30",
            isPassword && "pr-11",
            className,
          )}
          {...register(name)}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? t.login.hidePassword : t.login.showPassword}
            aria-pressed={show}
            className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-ink-3 hover:text-ink"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {touched && error && (
        <p id={errorId} role="alert" className="text-xs text-down">
          {error}
        </p>
      )}
    </div>
  );
}
