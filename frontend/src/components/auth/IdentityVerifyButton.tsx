"use client";

import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth as t } from "@/messages/auth";

interface Props {
  onVerified: (verificationToken: string) => void;
  disabled?: boolean;
  label?: string;
}

/**
 * 휴대폰 본인인증 버튼.
 * TODO(본인인증 업체 계약 전): 지금은 UI 스텁. 누르면 바로 성공 처리하고 가짜 토큰을 넘긴다.
 * 계약 후 PASS/NICE 팝업을 띄우고, 업체가 돌려준 토큰을 onVerified 로. 백엔드는 그 토큰으로 업체에 재확인.
 */
export function IdentityVerifyButton({ onVerified, disabled = false, label = t.verify.button }: Props) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={() => onVerified("stub-verification-token")}
      className="h-11 w-full text-[15px] font-bold border-primary text-primary hover:bg-primary-soft hover:text-primary-dark"
    >
      <ShieldCheck /> {label}
    </Button>
  );
}
