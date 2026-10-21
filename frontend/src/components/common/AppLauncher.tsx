"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Icon } from "@/components/common/Icon";
import { QuickIcon, type QuickIconName } from "@/components/common/QuickIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { acceptOf, checkUpload, type UploadKind } from "@/lib/validation/upload";
import { home } from "@/messages/home";
import { upload } from "@/messages/upload";

const t = home.quick;

// 견적 3개는 견적 화면이 따로 없어 그 일을 하는 화면으로 (2026-10-20): 요청은 검색 결과의 [견적 요청],
// 판매자 처리는 받은 구매요청, 구매자 확인은 내 구매목록. QuickMenu 와 같은 표
const routes = {
  sellManual: "/listings/new",
  sellExtra: "/listings/extra",
  sellQuote: "/my/sales",
  buyRequest: "/search",
  buyQuotes: "/my/purchases",
};

type Tone = "sell" | "buy";
// seq: 같은 문구가 연달아 나와도 알림 요소를 새로 그려 스크린리더가 다시 읽게 한다 (key 로 사용)
type Notice = { error: boolean; text: string; seq: number } | null;

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
 * 링크는 일반 Link 라 타일 큐 엔진이 가로챈다. 파일 고르기는 메뉴를 닫지 않고 결과를 메뉴 아래에 알린다.
 */
export function AppLauncher() {
  const fileRef = useRef<HTMLInputElement>(null);
  const kindRef = useRef<UploadKind>("excel");
  const [notice, setNotice] = useState<Notice>(null);
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
    setNotice((prev) => ({ error: error !== null, text: error ?? upload.pending(file.name), seq: (prev?.seq ?? 0) + 1 }));
  };

  const onPick = (e: Event, kind: UploadKind) => {
    e.preventDefault(); // 메뉴를 닫지 않는다 — 결과 알림이 메뉴 안에 보이게
    pickFile(kind);
  };

  return (
    <>
      <DropdownMenu
        modal={false}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setNotice(null);
            setNewOpen(false);
          }
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
            <DropdownMenuItem className={`${cellClass} ${toneClass.sell}`} onSelect={(e) => onPick(e, "excel")}>
              <Cell icon="sellBulk" label={t.sellBulk} />
            </DropdownMenuItem>
            <LinkCell tone="sell" icon="sellExtra" label={t.sellExtra} href={routes.sellExtra} onClick={close} />
            <LinkCell tone="sell" icon="sellQuote" label={t.sellQuote} href={routes.sellQuote} onClick={close} />
          </Section>
          <Section tone="buy" label={t.buy}>
            <LinkCell tone="buy" icon="buyRequest" label={t.buyRequest} href={routes.buyRequest} onClick={close} />
            <LinkCell tone="buy" icon="buyQuotes" label={t.buyQuotes} href={routes.buyQuotes} onClick={close} />
            <DropdownMenuItem className={`${cellClass} ${toneClass.buy}`} onSelect={(e) => onPick(e, "excel")}>
              <Cell icon="buyBulk" label={t.buyBulk} />
            </DropdownMenuItem>
          </Section>

          {notice && (
            <p
              key={notice.seq}
              role={notice.error ? "alert" : "status"}
              className={`mt-2 flex items-start gap-2 rounded-md bg-bg px-2.5 py-2 text-xs ${notice.error ? "text-down" : "text-ink-2"}`}
            >
              {/* 긴 파일 이름(공백 없음)이 메뉴 폭을 넘지 않게 */}
              <span className="min-w-0 grow break-all">{notice.text}</span>
              <button type="button" aria-label={t.dismiss} onClick={() => setNotice(null)} className="shrink-0 text-ink-3 hover:text-ink">
                <Icon name="close" size={14} />
              </button>
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <input ref={fileRef} type="file" className="hidden" onChange={onFile} tabIndex={-1} aria-hidden="true" />
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
