"use client";

import { useEffect, useState } from "react";
import { authApi } from "@/lib/api/auth";
import { initialOf } from "@/lib/userMenu";
import { my } from "@/messages/my";

type Profile = { nickname: string; kind: "PERSONAL" | "BUSINESS" };

/** 마이페이지 위쪽 사용자 카드. 이메일·전화·실명은 보이지 않는다. 조회가 실패하면 카드만 생략 (목록은 따로 동작) */
export function MyProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let alive = true;
    void authApi.me().then((res) => {
      if (alive && res.ok) setProfile(res.data);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!profile) return null;
  const business = profile.kind === "BUSINESS";
  return (
    <div className="flex items-center gap-4 pb-5 mb-5 border-b border-line-2">
      <span
        aria-hidden="true"
        className={`size-14 shrink-0 rounded-full flex items-center justify-center text-xl font-bold ${
          business ? "bg-primary-dark text-white" : "bg-primary-soft text-primary"
        }`}
      >
        {initialOf(profile.nickname)}
      </span>
      <div className="min-w-0 flex flex-col gap-1">
        <span className="truncate text-[17px] font-bold text-ink">{profile.nickname}</span>
        <span
          className={`w-fit h-5 px-1.5 inline-flex items-center rounded-[5px] text-[11px] font-semibold ${
            business ? "bg-primary-dark text-white" : "bg-primary-soft text-primary-dark"
          }`}
        >
          {business ? my.menu.business : my.menu.personal}
        </span>
      </div>
    </div>
  );
}
