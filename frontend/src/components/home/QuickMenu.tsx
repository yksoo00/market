"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Icon } from "@/components/common/Icon";
import { QuickIcon, type QuickIconName } from "@/components/home/QuickIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { acceptOf, checkUpload, type UploadKind } from "@/lib/validation/upload";
import { home } from "@/messages/home";
import { upload } from "@/messages/upload";

const t = home.quick;

// TODO(페이지 미구현): 임시 경로. 각 화면을 만들 때 실제 경로로 바꾼다
const routes = {
  sellManual: "/listings/new",
  sellExtra: "/listings/extra",
  sellQuote: "/quotes/adjust",
  buyRequest: "/requests/new",
  buyQuotes: "/quotes",
};

type Tone = "sell" | "buy";
// seq: 같은 문구가 연달아 나와도 알림 요소를 새로 그려 스크린리더가 다시 읽게 한다 (key 로 사용)
type Notice = { error: boolean; text: string; seq: number } | null;

const toneClass: Record<Tone, string> = {
  // 호버 배경은 -soft 토큰이 아니라 진한 색의 반투명. -soft 는 페이지 배경(bg)과 거의 같아 호버가 안 보이고,
  // 아이콘의 연한 면과도 같은 색이라 그림이 배경에 묻힌다
  sell: "text-primary [--quick-soft:var(--color-primary-soft)] hover:bg-primary/10",
  buy: "text-green [--quick-soft:var(--color-green-soft)] hover:bg-green/12",
};

const itemClass = "p-1 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-current";

export function QuickMenu() {
  const fileRef = useRef<HTMLInputElement>(null);
  const kindRef = useRef<UploadKind>("excel");
  const [notice, setNotice] = useState<Notice>(null);

  // 파일 input 하나를 종류마다 accept 만 바꿔 쓴다. 클릭 이벤트 안에서 바로 열어야 브라우저가 막지 않으므로
  // state 대신 ref·DOM 속성으로 넘긴다 (setState 는 다음 렌더에야 반영됨)
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
    setNotice((prev) => ({
      error: error !== null,
      text: error ?? upload.pending(file.name),
      seq: (prev?.seq ?? 0) + 1,
    }));
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-col @md:flex-row items-center justify-center gap-2 @md:gap-12">
        <Group tone="sell" label={t.sell}>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger aria-label={t.sellNew} title={t.sellNew} className={`${itemClass} ${toneClass.sell}`}>
              <QuickIcon name="sellNew" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-auto shadow-none ring-0 border border-line bg-surface text-ink">
              <DropdownMenuItem asChild>
                <Link href={routes.sellManual}>{t.manual}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => pickFile("excel")}>{t.fileExcel}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => pickFile("pdf")}>{t.filePdf}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => pickFile("image")}>{t.fileImage}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <FileButton tone="sell" icon="sellBulk" label={t.sellBulk} onClick={() => pickFile("excel")} />
          <LinkItem tone="sell" icon="sellExtra" label={t.sellExtra} href={routes.sellExtra} />
          <LinkItem tone="sell" icon="sellQuote" label={t.sellQuote} href={routes.sellQuote} />
        </Group>
        <Group tone="buy" label={t.buy}>
          <LinkItem tone="buy" icon="buyRequest" label={t.buyRequest} href={routes.buyRequest} />
          <LinkItem tone="buy" icon="buyQuotes" label={t.buyQuotes} href={routes.buyQuotes} />
          <FileButton tone="buy" icon="buyBulk" label={t.buyBulk} onClick={() => pickFile("excel")} />
        </Group>
      </div>

      <input ref={fileRef} type="file" className="hidden" onChange={onFile} tabIndex={-1} aria-hidden="true" />

      {notice && (
        <p
          key={notice.seq}
          role={notice.error ? "alert" : "status"}
          className={`flex items-center gap-2 text-[13px] ${notice.error ? "text-down" : "text-ink-2"}`}
        >
          {notice.text}
          <button type="button" aria-label={t.dismiss} onClick={() => setNotice(null)} className="text-ink-3 hover:text-ink">
            <Icon name="close" size={14} />
          </button>
        </p>
      )}
    </div>
  );
}

function Group({ tone, label, children }: { tone: Tone; label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1.5 @md:gap-3">
      <span
        className={`h-6 px-2 mr-1 rounded-[5px] flex items-center text-xs font-bold text-white ${
          tone === "sell" ? "bg-primary" : "bg-green"
        }`}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

interface ItemProps {
  tone: Tone;
  icon: QuickIconName;
  label: string;
}

function LinkItem({ tone, icon, label, href }: ItemProps & { href: string }) {
  return (
    <Link href={href} aria-label={label} title={label} className={`${itemClass} ${toneClass[tone]}`}>
      <QuickIcon name={icon} />
    </Link>
  );
}

function FileButton({ tone, icon, label, onClick }: ItemProps & { onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={`${itemClass} ${toneClass[tone]}`}>
      <QuickIcon name={icon} />
    </button>
  );
}
