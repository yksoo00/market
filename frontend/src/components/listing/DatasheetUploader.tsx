"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Loader2 } from "lucide-react";
import { Icon } from "@/components/common/Icon";
import { Label } from "@/components/ui/label";
import { uploadFile } from "@/lib/api/uploads";
import { uploadErrorMessage } from "@/lib/uploadError";
import { acceptOf, checkUpload } from "@/lib/validation/upload";
import { listing } from "@/messages/listing";

const t = listing.form;

type State = { status: "idle" } | { status: "uploading"; name: string } | { status: "done"; name: string; key: string };

interface Props {
  /** 업로드 키. 비었으면 "" */
  value: string;
  onChange: (key: string) => void;
  onUploadingChange: (uploading: boolean) => void;
  /** 검증·서버 오류 (fields.listingDataSheet) */
  error?: string;
}

/** 데이터시트 PDF 1개. 새로 고르면 바꾼다 */
export function DatasheetUploader({ value, onChange, onUploadingChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  const [problem, setProblem] = useState<string | null>(null);
  // 늦게 끝난 이전 업로드가 새로 고른 파일을 덮지 않게 요청 순번을 센다
  const seq = useRef(0);

  // TODO(수정 화면): 빈 상태에서 시작해 마운트 때 "" 를 폼에 넣는다. 수정 화면에서 쓰려면 value(기존 키)로 초기화해야 한다
  const key = state.status === "done" ? state.key : "";
  useEffect(() => {
    if (key !== value) onChange(key);
  }, [key, value, onChange]);
  const uploading = state.status === "uploading";
  useEffect(() => onUploadingChange(uploading), [uploading, onUploadingChange]);

  // 업로드에 실패한 파일. [다시 시도]가 고르기부터 다시 하지 않고 이 파일을 다시 올린다
  const [failed, setFailed] = useState<File | null>(null);

  const send = (file: File) => {
    const mine = ++seq.current;
    // 교체 업로드가 실패하면 이전에 올린 파일로 되돌린다 (실패했다고 이미 올린 데이터시트까지 사라지지 않게)
    const previous = state;
    setProblem(null);
    setFailed(null);
    setState({ status: "uploading", name: file.name });
    void uploadFile("listing-datasheet", file).then((result) => {
      if (mine !== seq.current) return;
      if (result.ok) {
        setState({ status: "done", name: file.name, key: result.data.key });
      } else {
        setState(previous);
        setProblem(uploadErrorMessage(result));
        setFailed(file);
      }
    });
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const check = checkUpload("pdf", file);
    if (check) {
      setProblem(check);
      setFailed(null);
      return;
    }
    send(file);
  };

  const remove = () => {
    seq.current++;
    setState({ status: "idle" });
    setProblem(null);
    setFailed(null);
  };

  // 서버·검증 오류(error)와 방금 업로드의 문제(problem)를 따로 보인다. 서버가 "다시 올려 주세요"라고 한 뒤
  // 다시 올리다 실패하면 둘 다 의미가 있고, 실패 원인·[다시 시도]가 서버 문구에 가려지면 안 된다
  const messages = [...new Set([error, problem].filter((m): m is string => Boolean(m)))];

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[13px] text-ink-2">
        {t.datasheet}
        <span className="font-normal text-ink-3">{t.datasheetHint}</span>
      </Label>
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="h-[34px] shrink-0 px-3 rounded-md border border-primary text-primary text-[13px] font-medium hover:bg-primary/10 disabled:opacity-40"
        >
          {t.datasheetPick}
        </button>
        {state.status !== "idle" && (
          <span className="flex items-center gap-1.5 min-w-0 text-[13px] text-ink-2">
            {uploading ? <Loader2 size={14} className="animate-spin shrink-0" aria-label={t.uploading} /> : <Icon name="file" size={16} />}
            {/* 공백 없는 긴 파일 이름이 가로 스크롤을 만들지 않게 */}
            <span className="truncate">{state.name}</span>
            <button type="button" aria-label={t.datasheetRemove} onClick={remove} className="shrink-0 text-ink-3 hover:text-ink">
              <Icon name="close" size={14} />
            </button>
          </span>
        )}
      </div>
      <input ref={inputRef} type="file" accept={acceptOf("pdf")} onChange={onPick} className="hidden" tabIndex={-1} aria-hidden="true" />
      {messages.map((m) => (
        <p key={m} role="alert" className="flex items-center gap-2 text-xs text-down">
          <span className="min-w-0">{m}</span>
          {m === problem && failed && !uploading && (
            <button type="button" onClick={() => send(failed)} className="shrink-0 font-medium text-primary hover:underline">
              {t.uploadRetry}
            </button>
          )}
        </p>
      ))}
    </div>
  );
}
