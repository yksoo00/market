"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { useFormContext, useWatch, type FieldValues, type Path } from "react-hook-form";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth as t } from "@/messages/auth";

/**
 * 한 필드의 표시 상태. FormProvider 안에서만.
 * 상태 테두리(design.md "폼 페이지"): blur 전엔 기본, blur 후 오류면 down, 통과면 up.
 * 입력 중 고쳐지면 즉시 반영 (useForm 의 reValidateMode: "onChange").
 */
export function useFieldStatus<T extends FieldValues>(name: Path<T>) {
  const { getFieldState, formState, control } = useFormContext<T>();
  const state = getFieldState(name, formState);
  const value = useWatch({ control, name }) as unknown;
  // 버튼 비활성으로 보통 못 오지만, 제출을 시도했다면 blur 안 한 칸도 오류를 보여준다
  const touched = state.isTouched || formState.isSubmitted;
  const error = touched ? state.error?.message : undefined;
  const valid = touched && !state.error && value !== "" && value !== undefined;
  return { error, valid, touched };
}

/** 입력 요소에 붙일 상태 클래스. aria-invalid 는 호출부가 붙인다 (오류 = destructive 테두리) */
export function statusClass(valid: boolean): string {
  return cn("h-11 px-3 text-[15px] bg-surface", valid && "border-up focus-visible:border-up focus-visible:ring-up/30");
}

interface ShellProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  /** 필드 아래 오류 문구. 없으면 안 그림 */
  error?: string;
  /** 오류가 없을 때 아래에 보여줄 안내 (예: "사용할 수 있는 아이디입니다") */
  note?: ReactNode;
  children: ReactNode;
}

/** 라벨 + 입력 자리 + 오류 문구 */
export function FieldShell({ label, htmlFor, hint, error, note, children }: ShellProps) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-[13px] text-ink-2">
        {label}
        {hint && <span className="font-normal text-ink-3">{hint}</span>}
      </Label>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-down">
          {error}
        </p>
      ) : (
        note && <p className="text-xs">{note}</p>
      )}
    </div>
  );
}

interface Props<T extends FieldValues> extends Omit<ComponentProps<"input">, "name" | "form"> {
  name: Path<T>;
  label: string;
  /** 라벨 오른쪽에 붙는 안내 (예: "변경 불가") */
  hint?: string;
  note?: ReactNode;
  /** 입력 오른쪽에 붙는 요소 (중복확인 버튼 등) */
  trailing?: ReactNode;
}

/** 라벨 + 텍스트 입력 + 오류 문구. 비밀번호는 보기 토글 포함 */
export function FormField<T extends FieldValues>({ name, label, hint, note, trailing, className, type, onChange, ...rest }: Props<T>) {
  const { register } = useFormContext<T>();
  const { error, valid, touched } = useFieldStatus<T>(name);
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const reg = register(name);

  return (
    <FieldShell label={label} htmlFor={name} hint={hint} error={error} note={note}>
      <div className="flex gap-2">
        <div className="relative grow min-w-0">
          <Input
            id={name}
            type={isPassword && show ? "text" : type}
            aria-invalid={touched && Boolean(error)}
            aria-describedby={error ? `${name}-error` : undefined}
            className={cn(statusClass(valid), isPassword && "pr-11", className)}
            {...reg}
            {...rest}
            onChange={(e) => {
              void reg.onChange(e); // register 의 onChange 를 덮어쓰지 않도록 둘 다 호출
              onChange?.(e);
            }}
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
        {trailing}
      </div>
    </FieldShell>
  );
}
