"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useGoAfterLogin } from "@/hooks/useGoAfterLogin";
import { authApi } from "@/lib/api/auth";

interface Props {
  children: ReactNode;
  destination: string;
}

export function RedirectIfAuthenticated({ children, destination }: Props) {
  // 이미 로그인 상태면 방금 로그인한 것과 같은 곳으로 (홈이면 전체 화면)
  const goAfterLogin = useGoAfterLogin();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    void authApi.me().then((result) => {
      if (!active) return;
      if (result.ok) {
        goAfterLogin(destination);
        return;
      }
      setChecked(true);
    });
    return () => {
      active = false;
    };
  }, [destination, goAfterLogin]);

  return checked ? children : null;
}
