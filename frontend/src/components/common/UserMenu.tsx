"use client";

import Link from "next/link";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authApi } from "@/lib/api/auth";
import { initialOf } from "@/lib/userMenu";
import { my } from "@/messages/my";

const t = my.menu;

interface Props {
  nickname: string;
  kind: "PERSONAL" | "BUSINESS";
  /** 로그아웃이 서버에서 성공한 뒤 (헤더가 로그인 전 모습으로 돌아간다) */
  onLoggedOut: () => void;
}

/**
 * 로그인 후 헤더 오른쪽의 사용자 아이콘 + 메뉴. 이메일·전화·실명은 보이지 않는다 (닉네임 + 개인/사업자만).
 * 사업자는 진한 면 + 흰 테두리, 개인은 연한 면으로 헤더(보라) 위에서도 구분된다.
 */
export function UserMenu({ nickname, kind, onLoggedOut }: Props) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [failed, setFailed] = useState(false);
  const business = kind === "BUSINESS";

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setFailed(false);
    const result = await authApi.logout();
    setLoggingOut(false);
    if (result.ok) onLoggedOut();
    else setFailed(true);
  };

  return (
    <DropdownMenu modal={false}>
      {/* 보이는 원은 36, 눌리는 영역은 44 (터치) */}
      <DropdownMenuTrigger aria-label={t.label} title={t.label} className="size-11 -mr-1 flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white">
        <span
          aria-hidden="true"
          className={`size-9 rounded-full flex items-center justify-center text-[15px] font-bold ${
            business ? "bg-primary-dark text-white ring-2 ring-white" : "bg-primary-soft text-primary"
          }`}
        >
          {initialOf(nickname)}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 min-w-56 shadow-none ring-0 border border-line bg-surface text-ink">
        <div className="px-2 py-2 flex items-center gap-2">
          <span className="min-w-0 truncate text-sm font-bold" title={nickname}>
            {nickname}
          </span>
          <span
            className={`shrink-0 h-5 px-1.5 inline-flex items-center rounded-[5px] text-[11px] font-semibold ${
              business ? "bg-primary-dark text-white" : "bg-primary-soft text-primary-dark"
            }`}
          >
            {business ? t.business : t.personal}
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/my">{t.myPage}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* 실패하면 오류를 보여 줘야 하므로 선택해도 메뉴를 닫지 않는다 (성공하면 헤더가 바뀌며 사라진다) */}
        <DropdownMenuItem
          disabled={loggingOut}
          onSelect={(event) => {
            event.preventDefault();
            void logout();
          }}
        >
          {loggingOut ? t.loggingOut : t.logout}
        </DropdownMenuItem>
        {failed && (
          <p role="alert" className="px-2 py-1.5 text-xs text-down">
            {t.logoutFailed}
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
