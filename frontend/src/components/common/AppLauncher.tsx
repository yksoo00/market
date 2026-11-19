"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Icon } from "@/components/common/Icon";
import { NoticeDialog, useNotice } from "@/components/common/NoticeDialog";
import { QuickIcon, type QuickIconName } from "@/components/common/QuickIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { acceptOf, checkUpload, type UploadKind } from "@/lib/validation/upload";
import { common } from "@/messages/common";
import { home } from "@/messages/home";
import { upload } from "@/messages/upload";

const t = home.quick;

// 견적 3개는 견적 화면이 따로 없어 그 일을 하는 화면으로 (2026-10-20): 요청은 검색 결과의 [견적 요청],
// 판매자 처리는 받은 구매요청, 구매자 확인은 내 구매목록. QuickMenu 와 같은 표
const routes = {
  sellManual: "/listings/new",
  sellExtra: "/listings/extra",
  sellBulk: "/listings/bulk",
  sellQuote: "/my/activity?tab=requests",
  buyRequest: "/search",
  buyQuotes: "/my/activity?tab=purchases",
  buyBulk: "/buy/bulk",
};

type Tone = "sell" | "buy";

const toneClass: Record<Tone, string> = {
  // 호버 배경은 -soft 토큰이 아니라 진한 색의 반투명 (-soft 는 아이콘의 연한 면과 같은 색이라 그림이 묻힌다)
  sell: "text-primary [--quick-soft:var(--color-primary-soft)] hover:bg-primary/10 focus:bg-primary/10 focus:text-primary data-open:bg-primary/10 data-open:text-primary",
  buy: "text-green [--quick-soft:var(--color-green-soft)] hover:bg-green/12 focus:bg-green/12 focus:text-green",
};

// 칸: 아이콘 위 · 이름 아래 (구글 앱 메뉴처럼, 사용자 지시 2026-10-13)
// focus:**:text-inherit — 기본 메뉴 항목은 포커스 때 안쪽 글자를 accent 색으로 바꾸는데, 아이콘 칸은 판매·구매 색을 유지
const cellClass = "h-auto flex-col justify-start gap-1.5 rounded-lg px-1 py-2.5 text-center cursor-pointer [&_svg:not([class*='size-'])]:size-auto not-data-[variant=destructive]:focus:**:text-inherit";

/**
 * 헤더 오른쪽 앱 메뉴(∷). 홈 가운데 판매·구매 아이콘 줄(QuickMenu)과 같은 항목 — 어느 화면에서나 가게 (decisions.md 2026-10-19 홈 아이콘 줄 복원).
 * 링크는 일반 Link 라 타일 큐 엔진이 가로챈다. 파일 고르기 결과는 메뉴를 닫고 안내 모달로 알린다.
 */
export function AppLauncher() {
  const fileRef = useRef<HTMLInputElement>(null);
  const kindRef = useRef<UploadKind>("excel");
  const { notice, show, close: closeNotice } = useNotice();
  const [open, setOpen] = useState(false);
  // 판매상품 등록의 등록 방법(직접 입력·파일) 펼침
  const [newOpen, setNewOpen] = useState(false);
  // 링크 항목은 onClick 으로 직접 닫는다 — 타일 엔진이 링크 클릭을 캡처 단계에서 preventDefault 해서
  // Radix 의 선택 후 닫기가 건너뛰어진다 (UserMenu 와 같은 이유)
  const close = () => setOpen(false);

  // 파일 input 하나를 종류마다 accept 만 바꿔 쓴다. 클릭 이벤트 안에서 바로 열어야 브라우저가 막지 않으므로
  // state 대신 ref·DOM 속성으로 넘긴다
  const pickFile = (kind: UploadKind) => {
    const input = fileRef.current;
    if (!input) return;
    kindRef.current = kind;
    input.accept = acceptOf(kind);
    input.click();
  };

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일을 다시 골라도 change 가 나게
    if (!file) return;
    const error = checkUpload(kindRef.current, file);
    // 메뉴가 열린 채 모달을 띄우면 포커스가 메뉴와 부딪치므로 먼저 닫는다
    close();
    show(
      error !== null
        ? { tone: "error", title: common.notice.uploadBlocked, message: error }
        : { tone: "success", title: common.notice.uploadChecked, message: upload.pending(file.name) },
    );
  };

  const onPick = (e: Event, kind: UploadKind) => {
    e.preventDefault(); // 파일 대화상자가 뜨는 동안 메뉴를 유지한다 (고른 뒤 onFile 에서 닫는다)
    pickFile(kind);
  };

  return (
    <>
      <DropdownMenu
        modal={false}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setNewOpen(false);
        }}
      >
        <DropdownMenuTrigger aria-label={t.apps} title={t.apps} className="w-11 h-11 flex items-center justify-center rounded-full text-on-primary hover:text-white hover:bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-white/60">
          <Icon name="apps" size={22} />
        </DropdownMenuTrigger>
        <DropdownMenuContent data-tile-from-home align="end" sideOffset={6} className="w-[19rem] p-3 shadow-none ring-0 border border-line bg-surface text-ink rounded-[10px]">
          <Section
            tone="sell"
            label={t.sell}
            extra={
              newOpen && (
                <div className="mt-1 flex flex-col rounded-md bg-bg p-1">
                  <DropdownMenuItem asChild onClick={close}>
                    <Link href={routes.sellManual}>{t.manual}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => onPick(e, "excel")}>{t.fileExcel}</DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => onPick(e, "pdf")}>{t.filePdf}</DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => onPick(e, "image")}>{t.fileImage}</DropdownMenuItem>
                </div>
              )
            }
          >
            {/* 등록 방법은 옆 하위 메뉴 대신 격자 아래에 펼친다 — 옆으로 열면 같은 줄의 다른 칸을 가린다 (코드리뷰) */}
            <DropdownMenuItem
              aria-expanded={newOpen}
              className={`${cellClass} ${toneClass.sell} ${newOpen ? "bg-primary/10" : ""}`}
              onSelect={(e) => {
                e.preventDefault();
                setNewOpen((o) => !o);
              }}
            >
              <Cell icon="sellNew" label={t.sellNew} />
            </DropdownMenuItem>
            <LinkCell tone="sell" icon="sellBulk" label={t.sellBulk} href={routes.sellBulk} onClick={close} />
            <LinkCell tone="sell" icon="sellExtra" label={t.sellExtra} href={routes.sellExtra} onClick={close} />
            <LinkCell tone="sell" icon="sellQuote" label={t.sellQuote} href={routes.sellQuote} onClick={close} />
          </Section>
          <Section tone="buy" label={t.buy}>
            <LinkCell tone="buy" icon="buyRequest" label={t.buyRequest} href={routes.buyRequest} onClick={close} />
            <LinkCell tone="buy" icon="buyQuotes" label={t.buyQuotes} href={routes.buyQuotes} onClick={close} />
            <LinkCell tone="buy" icon="buyBulk" label={t.buyBulk} href={routes.buyBulk} onClick={close} />
          </Section>
        </DropdownMenuContent>
      </DropdownMenu>
      <input ref={fileRef} type="file" className="hidden" onChange={onFile} tabIndex={-1} aria-hidden="true" />
      <NoticeDialog notice={notice} onClose={closeNotice} />
    </>
  );
}

function Section({ tone, label, extra, children }: { tone: Tone; label: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <DropdownMenuGroup aria-label={label} className="flex flex-col gap-1 not-first:mt-2 not-first:pt-2 not-first:border-t not-first:border-line-2">
      {/* 그룹 이름은 aria-label 로 읽히므로 배지는 스크린리더에서 뺀다 */}
      <span aria-hidden="true" className={`self-start h-5 px-1.5 rounded-[5px] flex items-center text-[11px] font-bold text-white ${tone === "sell" ? "bg-primary" : "bg-green"}`}>
        {label}
      </span>
      <div className="grid grid-cols-3 gap-1">{children}</div>
      {extra}
    </DropdownMenuGroup>
  );
}

function Cell({ icon, label }: { icon: QuickIconName; label: string }) {
  return (
    <>
      <QuickIcon name={icon} />
      <span className="text-xs leading-snug text-ink line-clamp-2">{label}</span>
    </>
  );
}

function LinkCell({ tone, icon, label, href, onClick }: { tone: Tone; icon: QuickIconName; label: string; href: string; onClick: () => void }) {
  return (
    <DropdownMenuItem asChild onClick={onClick} className={`${cellClass} ${toneClass[tone]}`}>
      <Link href={href}>
        <Cell icon={icon} label={label} />
      </Link>
    </DropdownMenuItem>
  );
}
