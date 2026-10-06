"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FieldShell } from "@/components/auth/FormField";
import { FormError, SubmitButton } from "@/components/auth/FormStatus";
import { SingleFileUploader } from "@/components/listing/SingleFileUploader";
import { listingsApi } from "@/lib/api/listings";
import {
  diffToExtraRequest,
  extraInitialValues,
  WARRANTY_COVERAGES,
  WARRANTY_MONTHS,
  type ExtraValues,
} from "@/lib/listingExtra";
import { listing } from "@/messages/listing";
import { UNREACHABLE } from "@/types/api";
import type { ListingDetail } from "@/types/listing";

const t = listing.extra;

const FILE_FIELDS = ["replaceProd", "testReport", "certificateOfAuthen"] as const;
type FileField = (typeof FILE_FIELDS)[number];
const KNOWN_FIELDS = new Set<string>(["warrantyPeriod", "warrantyCoverage", ...FILE_FIELDS]);

const fileSpec: Record<FileField, { uploadKind: "listing-replace-prod" | "listing-test-report" | "listing-certificate"; label: string }> = {
  replaceProd: { uploadKind: "listing-replace-prod", label: t.replaceProd },
  testReport: { uploadKind: "listing-test-report", label: t.testReport },
  certificateOfAuthen: { uploadKind: "listing-certificate", label: t.certificate },
};

const selectClass =
  "h-11 w-full rounded-md border border-line bg-surface px-3 text-[15px] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

/**
 * 판매정보 추가등록 폼 — 보증기간·불량지원·대체품·테스트리포트·정품인증서. 입력이 전부 선택·업로드라
 * react-hook-form 없이 상태 하나로 두고, 처음 값과 달라진 칸만 PATCH 로 보낸다 (스펙 2026-10-06-listing-edit-extra-design.md)
 */
export function ExtraForm({ detail }: { detail: ListingDetail }) {
  const router = useRouter();
  const initial = useMemo(() => extraInitialValues(detail), [detail]);
  const [values, setValues] = useState<ExtraValues>(initial);
  const [uploading, setUploading] = useState<Record<FileField, boolean>>({ replaceProd: false, testReport: false, certificateOfAuthen: false });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const patch = diffToExtraRequest(initial, values);
  const changed = Object.keys(patch).length > 0;
  const anyUploading = Object.values(uploading).some(Boolean);

  const set = useCallback(<K extends keyof ExtraValues>(key: K, value: ExtraValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    // 고치면 그 칸의 서버 오류는 지운다
    const name = key === "warrantyMonths" ? "warrantyPeriod" : key;
    setFieldErrors((e) => {
      if (!(name in e)) return e;
      return Object.fromEntries(Object.entries(e).filter(([k]) => k !== name));
    });
  }, []);

  const submit = async () => {
    if (!changed || anyUploading || submitting || done) return;
    setFormError(null);
    setUnreachable(false);
    setSubmitting(true);
    const result = await listingsApi.update(detail.userId, detail.regDate, patch);
    setSubmitting(false);
    if (result.ok) {
      setDone(true);
      router.push(`/listings/${detail.userId}/${detail.regDate}`);
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    const fields = Object.entries(result.fields ?? {});
    const known = fields.filter(([k]) => KNOWN_FIELDS.has(k));
    setFieldErrors(Object.fromEntries(known));
    const unmatched = fields.find(([k]) => !KNOWN_FIELDS.has(k));
    // 필드 오류가 있으면 그 칸에(못 찾은 건 폼 위), 없으면 코드별 문구 → 서버 문구 (applyServerError 와 같은 규칙)
    setFormError(fields.length > 0 ? (unmatched?.[1] ?? null) : (listing.errors[result.code] ?? result.message));
  };

  const fileField = (name: FileField) => (
    <SingleFileUploader
      uploadKind={fileSpec[name].uploadKind}
      checkKind="doc"
      label={fileSpec[name].label}
      hint={t.docHint}
      pickLabel={t.filePick}
      removeLabel={t.fileRemove(fileSpec[name].label)}
      value={values[name]}
      initialKey={initial[name] || undefined}
      onChange={(key) => set(name, key)}
      onUploadingChange={(u) => setUploading((p) => (p[name] === u ? p : { ...p, [name]: u }))}
      error={fieldErrors[name]}
    />
  );

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-6"
    >
      <FormError message={formError} onRetry={unreachable && !anyUploading && !submitting ? () => void submit() : undefined} />

      <section className="flex flex-col gap-1 border-b border-line-2 pb-4">
        <h2 className="text-[15px] font-bold text-ink">{detail.prodName}</h2>
        <p className="text-xs text-ink-2">
          {detail.prodBrand}
          {detail.prodNo && <span className="num"> · {detail.prodNo}</span>}
        </p>
      </section>

      <div className="flex flex-col gap-4">
        <SelectField id="warrantyMonths" label={t.warranty} error={fieldErrors.warrantyPeriod}>
          <select
            id="warrantyMonths"
            value={values.warrantyMonths}
            onChange={(e) => set("warrantyMonths", Number(e.target.value))}
            aria-invalid={Boolean(fieldErrors.warrantyPeriod)}
            aria-describedby={fieldErrors.warrantyPeriod ? "warrantyMonths-error" : undefined}
            className={selectClass}
          >
            {WARRANTY_MONTHS.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? t.warrantyNone : t.warrantyMonths(m)}
              </option>
            ))}
          </select>
        </SelectField>

        <SelectField id="warrantyCoverage" label={t.coverage} error={fieldErrors.warrantyCoverage}>
          <select
            id="warrantyCoverage"
            value={values.warrantyCoverage}
            onChange={(e) => set("warrantyCoverage", e.target.value)}
            aria-invalid={Boolean(fieldErrors.warrantyCoverage)}
            aria-describedby={fieldErrors.warrantyCoverage ? "warrantyCoverage-error" : undefined}
            className={selectClass}
          >
            {WARRANTY_COVERAGES.map((c) => (
              <option key={c} value={c}>
                {c === "" ? t.coverageNone : c}
              </option>
            ))}
          </select>
        </SelectField>

        {FILE_FIELDS.map((name) => (
          <div key={name}>{fileField(name)}</div>
        ))}
      </div>

      {!changed && !done && <p className="-mb-3 text-center text-xs text-ink-3">{t.noChange}</p>}
      {/* 바꾼 칸이 없거나 업로드 중이면 막는다 — 업로드 중엔 키가 아직 없다 */}
      <SubmitButton label={t.save} disabled={!changed || anyUploading || done} submitting={submitting} />
    </form>
  );
}

function SelectField({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <FieldShell inline label={label} htmlFor={id} error={error}>
      {children}
    </FieldShell>
  );
}
