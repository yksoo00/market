"use client";

import Link from "next/link";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  // 제어 컴포넌트: 타일 엔진이 링크 클릭을 캡처 단계에서 preventDefault 해서 Radix 가 [마이페이지] 선택 뒤 메뉴를 닫지 못한다
  const [open, setOpen] = useState(false);
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
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // 지난번 실패 문구가 다음에 열 때 남아 있지 않게
        if (next) setFailed(false);
      }}
    >
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
      {/* 링크 항목은 모두 onClick 으로 직접 닫는다 — 타일 엔진이 링크 클릭을 캡처 단계에서 preventDefault 해서 Radix 의 선택 후 닫기가 건너뛰어진다 */}
      <DropdownMenuContent align="end" className="w-56 min-w-56 shadow-none ring-0 border border-line bg-surface text-ink">
        <DropdownMenuLabel className="px-2 py-2 flex items-center gap-2 font-normal">
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
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild onClick={() => setOpen(false)}>
          <Link href="/my">{t.myPage}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild onClick={() => setOpen(false)}>
          <Link href="/my/listings">{t.myListings}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild onClick={() => setOpen(false)}>
          <Link href="/my/purchases">{t.myPurchases}</Link>
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
