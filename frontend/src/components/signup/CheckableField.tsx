"use client";

import { useState, type ComponentProps } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/auth/FormField";
import { authApi } from "@/lib/api/auth";
import { loginIdSchema } from "@/lib/validation/auth";
import { nicknameSchema, type PersonalSignupInput } from "@/lib/validation/signup";
import { common as tc } from "@/messages/common";
import { signup as t } from "@/messages/signup";

type Name = "loginId" | "nickname";
type Status = "idle" | "checking" | "available" | "taken" | "error";

interface Props extends Omit<ComponentProps<"input">, "name" | "form"> {
  name: Name;
  label: string;
  hint?: string;
  /** 부모가 제출 가능 여부를 판단하도록 결과를 올려보냄 */
  onStatus: (name: Name, available: boolean) => void;
}

const schemas = { loginId: loginIdSchema, nickname: nicknameSchema };

/** 아이디·닉네임: 입력 + 중복확인 버튼. 값이 바뀌면 확인 결과는 무효 */
export function CheckableField({ name, label, hint, onStatus, ...rest }: Props) {
  const { control, getValues, setError, clearErrors } = useFormContext<PersonalSignupInput>();
  const value = useWatch({ control, name });
  const [status, setStatus] = useState<Status>("idle");

  const formatOk = schemas[name].safeParse(value).success;

  // 확인한 값과 달라지면 결과는 무효. 입력 이벤트에서 처리 (effect 로 setState 하지 않음)
  function onChange() {
    if (status === "idle") return;
    setStatus("idle");
    onStatus(name, false);
    clearErrors(name);
  }

  async function check() {
    const asked = value;
    setStatus("checking");
    const res = name === "loginId" ? await authApi.checkLoginId(asked) : await authApi.checkNickname(asked);
    if (getValues(name) !== asked) return; // 응답 오는 사이 값이 바뀜 → onChange 가 이미 idle 로 되돌림
    if (!res.ok) {
      setStatus("error");
      setError(name, { type: "server", message: res.message });
      return;
    }
    if (res.data.available) {
      setStatus("available");
      onStatus(name, true);
    } else {
      setStatus("taken");
      setError(name, { type: "server", message: t.form.taken[name] });
    }
  }

  return (
    <FormField<PersonalSignupInput>
      name={name}
      label={label}
      hint={hint}
      onChange={onChange}
      note={status === "available" && <span className="text-up">{t.form.available[name]}</span>}
      trailing={
        <Button
          type="button"
          variant="outline"
          onClick={check}
          disabled={!formatOk || status === "checking" || status === "available"}
          className="h-11 shrink-0 px-3.5 text-[13px] font-semibold border-primary text-primary hover:bg-primary-soft hover:text-primary-dark"
        >
          {status === "checking" ? tc.submitting : t.form.check}
        </Button>
      }
      {...rest}
    />
  );
}
