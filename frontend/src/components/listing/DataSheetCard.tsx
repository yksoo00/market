"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchFile } from "@/lib/api/client";
import { filePath } from "@/lib/files";
import { dataSheetKey } from "@/lib/listingDetail";
import { listing } from "@/messages/listing";
import type { ListingDetail } from "@/types/listing";

const t = listing.detail;
// refresh 까지 실패한 401 — 로그인이 풀린 것으로 보고 "로그인 후 열람"으로 바꾼다
const AUTH_LOST = new Set(["UNAUTHENTICATED", "SESSION_EXPIRED", "UNAUTHORIZED"]);

/** 카드 ② 데이터시트 + 서류. 비공개 파일이라 로그인 사용자만, blob 으로 받아 띄운다 (decisions.md 2026-10-02) */
export function DataSheetCard({ detail, loggedIn }: { detail: ListingDetail; loggedIn: boolean }) {
  const [authLost, setAuthLost] = useState(false);
  const key = dataSheetKey(detail);

  return (
    <section className="rounded-md border border-line bg-surface p-4 @md:p-6 flex flex-col gap-3">
      <h2 className="text-[15px] font-bold text-ink">{t.dataSheet}</h2>
      {!loggedIn || authLost ? (
        <LoginPrompt />
      ) : (
        <>
          {key ? <PdfViewer key={key} fileKey={key} onAuthLost={setAuthLost} /> : <p className="text-sm text-ink-3">{t.noDataSheet}</p>}
          <DocLinks detail={detail} onAuthLost={setAuthLost} />
        </>
      )}
    </section>
  );
}

function LoginPrompt() {
  const pathname = usePathname();
  return (
    <p className="text-sm text-ink-2">
      {t.loginToView}{" "}
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="text-primary font-medium hover:underline">
        {t.login}
      </Link>
    </p>
  );
}

type ViewerState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; url: string };

function PdfViewer({ fileKey, onAuthLost }: { fileKey: string; onAuthLost: (lost: boolean) => void }) {
  const [state, setState] = useState<ViewerState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    void fetchFile(filePath(fileKey)).then((res) => {
      if (!alive) return;
      if (res.ok) {
        url = URL.createObjectURL(res.data);
        setState({ kind: "ready", url });
      } else if (AUTH_LOST.has(res.code)) onAuthLost(true);
      else setState({ kind: "error" });
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileKey, attempt, onAuthLost]);

  if (state.kind === "loading") return <div className="w-full h-120 @md:h-160 rounded-md bg-line-2 animate-pulse" aria-busy="true" />;
  if (state.kind === "error") {
    const retry = () => {
      setState({ kind: "loading" });
      setAttempt((n) => n + 1);
    };
    return (
      <div role="alert" className="flex items-center gap-3 text-sm text-down">
        {t.fileLoadFailed}
        <button type="button" onClick={retry} className="h-8.5 px-3 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft">
          {t.retry}
        </button>
      </div>
    );
  }
  return <iframe title={t.dataSheet} src={state.url} className="w-full h-120 @md:h-160 rounded-md border border-line-2" />;
}

function DocLinks({ detail, onAuthLost }: { detail: ListingDetail; onAuthLost: (lost: boolean) => void }) {
  const [failed, setFailed] = useState<string | null>(null);
  const docs = [
    { label: t.docs.testReport, key: detail.testReport },
    { label: t.docs.certificate, key: detail.certificateOfAuthen },
    { label: t.docs.replaceProd, key: detail.replaceProd },
  ];

  const open = async (label: string, key: string) => {
    // await 뒤에 열면 팝업 차단에 걸린다 — 클릭 순간 빈 탭을 먼저 열고, 받은 뒤 주소를 채운다
    const tab = window.open("", "_blank");
    const res = await fetchFile(filePath(key));
    if (res.ok && tab) {
      const url = URL.createObjectURL(res.data);
      tab.location.href = url;
      // 새 탭이 읽는 중일 수 있어 바로 해제하지 않는다
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setFailed(null);
      return;
    }
    tab?.close();
    if (!res.ok && AUTH_LOST.has(res.code)) onAuthLost(true);
    else setFailed(label);
  };

  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
      {docs.map(({ label, key }) => (
        <li key={label} className="flex items-center gap-1.5">
          {key ? (
            <button type="button" onClick={() => void open(label, key)} className="text-primary font-medium hover:underline">
              {label}
            </button>
          ) : (
            <>
              <span className="text-ink-2">{label}</span>
              <span className="text-ink-3">{t.empty}</span>
            </>
          )}
          {failed === label && (
            <span role="alert" className="text-[13px] text-down">
              {t.fileLoadFailed}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
