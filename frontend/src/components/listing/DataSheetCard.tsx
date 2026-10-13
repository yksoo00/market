"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FilePreviewDialog } from "@/components/listing/FilePreviewDialog";
import { fetchFile } from "@/lib/api/client";
import { filePath, isSafeFileType } from "@/lib/files";
import { isAuthLost } from "@/lib/listingDetail";
import { listing } from "@/messages/listing";
import type { ListingDetail } from "@/types/listing";

const t = listing.detail;

/**
 * 카드 ② 데이터시트 + 서류(테스트리포트·정품인증서) 작은 미리보기, 누르면 모달로 크게. 대체품은 파일이 아니라 글.
 * 비공개 파일이라 로그인 사용자만, blob 으로 받아 띄운다 (decisions.md 2026-10-02, 2026-10-13).
 * loggedIn 이 null 이면 아직 모름 — "로그인 후 열람"이 잠깐 비쳤다 사라지지 않게 자리만 잡는다
 */
export function DataSheetCard({ detail, loggedIn }: { detail: ListingDetail; loggedIn: boolean | null }) {
  const [authLost, setAuthLost] = useState(false);
  const docs = [
    { label: t.dataSheet, fileKey: detail.listingDataSheet },
    { label: t.docs.testReport, fileKey: detail.testReport },
    { label: t.docs.certificate, fileKey: detail.certificateOfAuthen },
  ];

  return (
    <section className="rounded-md border border-line bg-surface p-4 @md:p-6 flex flex-col gap-3">
      <h2 className="text-[15px] font-bold text-ink">{t.documents}</h2>
      {loggedIn === null ? (
        <div className="grid grid-cols-1 @md:grid-cols-3 gap-3" aria-busy="true">
          {docs.map((d) => (
            <PreviewSkeleton key={d.label} />
          ))}
        </div>
      ) : !loggedIn || authLost ? (
        <LoginPrompt />
      ) : (
        <div className="grid grid-cols-1 @md:grid-cols-3 gap-3">
          {docs.map((d) => (
            <DocTile key={`${d.label}:${d.fileKey ?? ""}`} label={d.label} fileKey={d.fileKey} onAuthLost={setAuthLost} />
          ))}
        </div>
      )}
      <p className="text-sm text-ink-2">
        <span className="font-medium text-ink">{t.docs.replaceProd}</span>{" "}
        {detail.replaceProd ? <span className="whitespace-pre-line wrap-break-word">{detail.replaceProd}</span> : <span className="text-ink-3">{t.empty}</span>}
      </p>
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

function PreviewSkeleton() {
  return <div className="h-44 rounded-md bg-line-2 animate-pulse" />;
}

type FileState = { kind: "loading" } | { kind: "error" } | { kind: "unsupported" } | { kind: "ready"; url: string; media: "pdf" | "image" };

/** 서류 1개를 blob 으로 받는다. 다시 받으려면 호출한 쪽이 key 를 바꿔 다시 마운트한다(그래야 로딩 표시로 돌아간다) */
function useFileBlob(fileKey: string, onAuthLost: (lost: boolean) => void): FileState {
  const [state, setState] = useState<FileState>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    void fetchFile(filePath(fileKey)).then((res) => {
      if (!alive) return;
      if (!res.ok) {
        if (isAuthLost(res.code)) onAuthLost(true);
        else setState({ kind: "error" });
        return;
      }
      // PDF·이미지만 앱 출처의 iframe/img 에 띄운다. 그 밖 형식은 다시 받아도 같아 [다시 시도]를 주지 않는다
      const media = res.data.type === "application/pdf" ? "pdf" : isSafeFileType(res.data.type) ? "image" : null;
      if (!media) {
        setState({ kind: "unsupported" });
        return;
      }
      url = URL.createObjectURL(res.data);
      setState({ kind: "ready", url, media });
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileKey, onAuthLost]);

  return state;
}

function DocTile({ label, fileKey, onAuthLost }: { label: string; fileKey: string | null; onAuthLost: (lost: boolean) => void }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <h3 className="text-[13px] font-medium text-ink-2">{label}</h3>
      {fileKey ? (
        <FileTile key={attempt} label={label} fileKey={fileKey} onAuthLost={onAuthLost} onRetry={() => setAttempt((n) => n + 1)} />
      ) : (
        <div className="h-44 rounded-md border border-dashed border-line-2 flex items-center justify-center text-sm text-ink-3">{t.noDoc}</div>
      )}
    </div>
  );
}

function FileTile({ label, fileKey, onAuthLost, onRetry }: { label: string; fileKey: string; onAuthLost: (lost: boolean) => void; onRetry: () => void }) {
  const [open, setOpen] = useState(false);
  const state = useFileBlob(fileKey, onAuthLost);

  if (state.kind === "loading") return <PreviewSkeleton />;
  if (state.kind === "unsupported") return <div className="h-44 rounded-md border border-line-2 flex items-center justify-center px-3 text-center text-sm text-ink-3">{t.unsupportedDoc}</div>;
  if (state.kind === "error") {
    return (
      <div role="alert" className="h-44 rounded-md border border-line-2 flex flex-col items-center justify-center gap-2 px-3 text-center text-sm text-down">
        {t.fileLoadFailed}
        <button type="button" onClick={onRetry} className="h-8.5 px-3 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft">
          {t.retry}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.enlarge(label)}
        className="relative h-44 w-full overflow-hidden rounded-md border border-line-2 bg-bg hover:border-primary focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 outline-none"
      >
        {state.media === "pdf" ? (
          // 첫 쪽만 작게. 눌림은 바깥 버튼이 받도록 iframe 은 마우스를 받지 않는다
          <iframe title={label} src={`${state.url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} tabIndex={-1} className="h-full w-full pointer-events-none" />
        ) : (
          // blob 이라 next/image 대상이 아니다
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.url} alt="" className="h-full w-full object-contain" />
        )}
        <span className="absolute bottom-1.5 right-1.5 h-6 px-2 rounded-[5px] flex items-center bg-surface/90 border border-line text-[11px] font-medium text-ink-2">{t.enlargeShort}</span>
      </button>
      {/* Android Chrome 등은 iframe 안에서 PDF 를 못 그린다 — 새 탭(브라우저 기본 PDF 보기)으로 여는 길을 항상 둔다.
          이미 받은 blob 을 그대로 연다 (다시 받지 않게) */}
      <a href={state.url} target="_blank" rel="noopener" className="self-start text-[13px] text-primary font-medium hover:underline">
        {t.openInNewTab}
      </a>
      <FilePreviewDialog open={open} onOpenChange={setOpen} title={label} url={state.url} media={state.media} />
    </>
  );
}
