"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Loader2, RotateCw } from "lucide-react";
import { Icon } from "@/components/common/Icon";
import { Label } from "@/components/ui/label";
import { uploadFile } from "@/lib/api/uploads";
import { uploadErrorMessage } from "@/lib/uploadError";
import { MAX_PHOTOS } from "@/lib/validation/listing";
import { acceptOf, checkUpload } from "@/lib/validation/upload";
import { listing } from "@/messages/listing";

const t = listing.form;

interface Slot {
  id: number;
  previewUrl: string;
  /** 실패하면 같은 파일로 다시 올린다 (고르기부터 다시 하지 않게) */
  file: File;
  key?: string;
  status: "uploading" | "done" | "error";
  message?: string;
}

interface Props {
  /** 업로드가 끝난 키 (칸 순서) */
  value: string[];
  onChange: (keys: string[]) => void;
  onUploadingChange: (uploading: boolean) => void;
  /** 검증·서버 오류 (fields.photos) */
  error?: string;
}

/** 사진 최대 4장. 고르는 즉시 올리고(2단계 업로드) 키만 폼 값으로 넘긴다. 미리보기는 고른 파일 자체 */
export function PhotoUploader({ value, onChange, onUploadingChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // TODO(수정 화면): 지금은 빈 칸에서 시작해 마운트 때 [] 를 폼에 넣는다. 수정 화면에서 쓰려면 slots 를 value(기존 키)로 초기화해야 기존 사진이 안 지워진다
  // 부모(폼) 값과 업로드 상태를 칸 상태에서 계산해 알린다. 같은 값이면 알리지 않아 폼이 불필요하게 다시 검증하지 않게
  // 배열은 렌더마다 새로 생겨 effect 의존성으로 못 쓴다 → 문자열로 비교 (키에는 "|"가 없다: 폴더/uuid.확장자)
  const joinedKeys = slots.flatMap((s) => (s.status === "done" && s.key ? [s.key] : [])).join("|");
  const uploading = slots.some((s) => s.status === "uploading");
  useEffect(() => {
    if (joinedKeys !== value.join("|")) onChange(joinedKeys === "" ? [] : joinedKeys.split("|"));
  }, [joinedKeys, value, onChange]);
  useEffect(() => onUploadingChange(uploading), [uploading, onUploadingChange]);

  // 화면을 떠날 때 미리보기 URL 해제 (브라우저 메모리)
  const slotsRef = useRef(slots);
  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);
  useEffect(() => () => slotsRef.current.forEach((s) => URL.revokeObjectURL(s.previewUrl)), []);

  const update = (id: number, patch: Partial<Slot>) => setSlots((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  // 그사이 칸을 지웠으면 update 가 아무것도 바꾸지 않는다
  const send = (id: number, file: File) => {
    update(id, { status: "uploading", message: undefined });
    void uploadFile("listing-photo", file).then((result) =>
      update(id, result.ok ? { status: "done", key: result.data.key } : { status: "error", message: uploadErrorMessage(result) }),
    );
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = ""; // 같은 파일을 다시 골라도 change 가 나게
    const room = MAX_PHOTOS - slots.length;
    const messages: string[] = picked.length > room ? [t.photosOver] : [];
    const accepted: File[] = [];
    for (const file of picked.slice(0, room)) {
      const problem = checkUpload("image", file);
      if (problem) messages.push(problem);
      else accepted.push(file);
    }
    setNotice(messages.length > 0 ? messages.join(" · ") : null);

    const added: Slot[] = accepted.map((file) => ({ id: nextId.current++, previewUrl: URL.createObjectURL(file), file, status: "uploading" }));
    setSlots((list) => [...list, ...added]);
    for (const slot of added) send(slot.id, slot.file);
  };

  const remove = (id: number) => {
    setSlots((list) => {
      const slot = list.find((s) => s.id === id);
      if (slot) URL.revokeObjectURL(slot.previewUrl);
      return list.filter((s) => s.id !== id);
    });
  };

  const firstDoneId = slots.find((s) => s.status === "done")?.id;
  const slotErrors = slots.flatMap((s) => (s.status === "error" && s.message ? [s.message] : []));
  // 여러 장이 같은 이유로 실패하면 같은 문구가 반복된다 → 한 번만 (key 로도 쓰므로 중복 금지)
  const messages = [...new Set([error, notice, ...slotErrors].filter((m): m is string => Boolean(m)))];

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[13px] text-ink-2">
        {t.photos}
        <span className="font-normal text-ink-3">{t.photosHint}</span>
      </Label>
      <div className="grid grid-cols-2 @md:grid-cols-4 gap-2">
        {slots.map((slot, i) => (
          <div key={slot.id} className={`relative aspect-square overflow-hidden rounded-md border bg-bg ${slot.status === "error" ? "border-down" : "border-line"}`}>
            {/* blob 미리보기는 next/image 최적화 대상이 아니다 (서버 URL 이 아님) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slot.previewUrl} alt={t.photoAlt(i + 1)} className={`h-full w-full object-cover ${slot.status === "done" ? "" : "opacity-50"}`} />
            {slot.id === firstDoneId && (
              <span className="absolute left-1.5 top-1.5 h-5 px-1.5 rounded-[5px] flex items-center bg-primary-soft text-primary-dark text-[11px] font-semibold">
                {t.photoMain}
              </span>
            )}
            {slot.status === "error" && (
              <button
                type="button"
                aria-label={t.photoRetry(i + 1)}
                onClick={() => send(slot.id, slot.file)}
                className="absolute inset-0 m-auto size-10 rounded-full bg-surface border border-line flex items-center justify-center text-ink-2 hover:border-primary hover:text-primary"
              >
                <RotateCw size={18} />
              </button>
            )}
            {slot.status === "uploading" && (
              <span role="status" aria-label={t.uploading} className="absolute inset-0 flex items-center justify-center text-primary">
                <Loader2 className="animate-spin" />
              </span>
            )}
            <button
              type="button"
              aria-label={t.photoRemove(i + 1)}
              onClick={() => remove(slot.id)}
              className="absolute right-1.5 top-1.5 size-7 rounded-full bg-surface border border-line flex items-center justify-center text-ink-2 hover:border-primary hover:text-ink"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
        {slots.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-md border border-dashed border-line bg-surface flex flex-col items-center justify-center gap-1 text-[13px] text-ink-2 hover:border-primary hover:text-primary"
          >
            <Icon name="image" size={22} />
            {t.photoAdd}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" multiple accept={acceptOf("image")} onChange={onPick} className="hidden" tabIndex={-1} aria-hidden="true" />
      {messages.map((m) => (
        <p key={m} role="alert" className="text-xs text-down">
          {m}
        </p>
      ))}
    </div>
  );
}
