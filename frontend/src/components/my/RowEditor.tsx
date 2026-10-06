"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "cn";
import { PhotoUploader } from "@/components/listing/PhotoUploader";
import { SingleFileUploader } from "@/components/listing/SingleFileUploader";
import { listingsApi } from "@/lib/api/listings";
import { WARRANTY_COVERAGES, WARRANTY_MONTHS } from "@/lib/listingExtra";
import { todayInSeoul } from "@/lib/listingForm";
import { diffToRowPatch, rowEditInitialValues, validateRowEdit, type RowEditValues } from "@/lib/rowEdit";
import { MAX_DESCRIPTION, PROD_STATES } from "@/lib/validation/listing";
import { listing } from "@/messages/listing";
import { my } from "@/messages/my";
import { search } from "@/messages/search";
import { UNREACHABLE } from "@/types/api";
import type { ListingDetail, ListingSearchItem } from "@/types/listing";

const c = search.columns;
const r = my.mine.row;
const lf = listing.form;
const le = listing.extra;

type Panel = "description" | "dataSheet" | "photos" | "replaceProd" | "testReport" | "certificate";

const FILE_PANELS = {
  replaceProd: { field: "replaceProd", uploadKind: "listing-replace-prod", label: le.replaceProd },
  testReport: { field: "testReport", uploadKind: "listing-test-report", label: le.testReport },
  certificate: { field: "certificateOfAuthen", uploadKind: "listing-certificate", label: le.certificate },
} as const;

// 서버 필드명 → 이 편집기의 칸 이름 (보증은 개월 칸, 나머지는 같다)
const SERVER_TO_FIELD: Record<string, keyof RowEditValues> = {
  prodName: "prodName",
  prodBrand: "prodBrand",
  prodNo: "prodNo",
  prodMufcDate: "prodMufcDate",
  prodState: "prodState",
  warrantyPeriod: "warrantyMonths",
  warrantyCoverage: "warrantyCoverage",
  description: "description",
  photos: "photos",
  listingDataSheet: "listingDataSheet",
  replaceProd: "replaceProd",
  testReport: "testReport",
  certificateOfAuthen: "certificateOfAuthen",
};
// 어느 패널의 칸인가 — 서버 오류가 패널 안 칸이면 그 패널을 연다
const FIELD_TO_PANEL: Partial<Record<keyof RowEditValues, Panel>> = {
  description: "description",
  photos: "photos",
  listingDataSheet: "dataSheet",
  replaceProd: "replaceProd",
  testReport: "testReport",
  certificateOfAuthen: "certificate",
};

const inputClass =
  "h-8.5 w-full min-w-0 rounded-md border border-line bg-surface px-2 text-[13px] text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-down";

type Loaded = { kind: "loading" } | { kind: "error" } | { kind: "ready"; detail: ListingDetail };

interface Props {
  item: ListingSearchItem;
  onCancel: () => void;
  /** 저장 성공 — 응답(상세)으로 표의 행을 갱신한다 */
  onSaved: (detail: ListingDetail) => void;
}

/**
 * 내 판매글 표의 행 안 수정 (스펙 2026-10-06-my-listings). 그 행만 표 맨 위에 남고 칸이 입력칸으로 바뀐다.
 * 파일·긴 글 칸(상품설명·데이터시트·사진·대체품·테스트리포트·정품인증서)은 누르면 행 아래에 그 항목 폼이 뜬다.
 * 저장은 [저장] 한 번 — 바뀐 칸만 PATCH. 열 때 상세를 다시 받아 초기값으로 쓴다(표의 행엔 사진·서류 키가 없다).
 */
export function RowEditor({ item, onCancel, onSaved }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    void listingsApi.get(item.userId, item.regDate).then((res) => {
      if (alive) setLoaded(res.ok ? { kind: "ready", detail: res.data } : { kind: "error" });
    });
    return () => {
      alive = false;
    };
  }, [item.userId, item.regDate, attempt]);

  if (loaded.kind === "ready") return <EditRow detail={loaded.detail} onCancel={onCancel} onSaved={onSaved} />;
  return (
    <div className="rounded-md border border-line bg-surface px-4 py-6 flex items-center justify-center gap-3 text-[13px] text-ink-2" aria-busy={loaded.kind === "loading"}>
      {loaded.kind === "loading" ? (
        <span>{r.loading}</span>
      ) : (
        <>
          <span role="alert" className="text-down">
            {r.loadFailed}
          </span>
          <button
            type="button"
            onClick={() => {
              setLoaded({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}
            className="h-8 px-3 rounded-md border border-primary text-primary font-medium hover:bg-primary-soft"
          >
            {r.retry}
          </button>
          <button type="button" onClick={onCancel} className="h-8 px-3 rounded-md border border-line text-ink-2 hover:bg-bg">
            {r.cancel}
          </button>
        </>
      )}
    </div>
  );
}

function EditRow({ detail, onCancel, onSaved }: { detail: ListingDetail; onCancel: () => void; onSaved: (d: ListingDetail) => void }) {
  const initial = useMemo(() => rowEditInitialValues(detail), [detail]);
  const [values, setValues] = useState<RowEditValues>(initial);
  // 제조일 범위의 "오늘". 연 날 기준으로 고정 (자정을 넘겨도 서버가 다시 본다)
  const [today] = useState(() => todayInSeoul());
  const [panel, setPanel] = useState<Panel | null>(null);
  // 서버가 돌려준 칸 오류. 그 칸을 고치면 지운다. 클라이언트 검사(clientErrors)는 입력할 때마다 다시 계산한다
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  // 숨은 패널 안 업로드 문제(형식·크기·실패) — 패널 단추를 붉게 하고 그 패널을 연다
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const patch = diffToRowPatch(initial, values);
  const changed = Object.keys(patch).length > 0;
  const anyUploading = Object.values(uploading).some(Boolean);
  // 입력 즉시 검사 (바뀐 칸만). 오류가 있으면 [저장]을 막는다
  const clientErrors = useMemo(() => validateRowEdit(initial, values, today), [initial, values, today]);
  const errors = { ...clientErrors, ...serverErrors, ...problems };
  const invalid = Object.keys(clientErrors).length > 0;

  const set = useCallback(<K extends keyof RowEditValues>(key: K, value: RowEditValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    // 고치면 그 칸의 서버 오류는 지운다
    setServerErrors((e) => {
      if (!(key in e)) return e;
      return Object.fromEntries(Object.entries(e).filter(([k]) => k !== key));
    });
  }, []);
  // 업로더의 effect 의존성이라 참조가 바뀌지 않게
  const setPhotos = useCallback((keys: string[]) => set("photos", keys), [set]);
  // 업로더의 effect 의존성이라 참조가 바뀌지 않게 (칸마다 하나씩)
  const problemSetters = useMemo(() => {
    const make = (name: keyof RowEditValues, panel: Panel) => (problem: string | null) =>
      setProblems((p) => {
        if ((p[name] ?? null) === problem) return p;
        if (problem === null) return Object.fromEntries(Object.entries(p).filter(([k]) => k !== name));
        setPanel(panel);
        return { ...p, [name]: problem };
      });
    return {
      photos: make("photos", "photos"),
      listingDataSheet: make("listingDataSheet", "dataSheet"),
      replaceProd: make("replaceProd", "replaceProd"),
      testReport: make("testReport", "testReport"),
      certificateOfAuthen: make("certificateOfAuthen", "certificate"),
    };
  }, []);
  const setUploadingOf = (name: string) => (u: boolean) => setUploading((p) => (p[name] === u ? p : { ...p, [name]: u }));
  const setPhotosUploading = useCallback((u: boolean) => setUploading((p) => (p.photos === u ? p : { ...p, photos: u })), []);

  const save = async () => {
    if (!changed || anyUploading || saving || invalid) return;
    setFormError(null);
    setUnreachable(false);
    setSaving(true);
    const result = await listingsApi.update(detail.userId, detail.regDate, patch);
    setSaving(false);
    if (result.ok) {
      onSaved(result.data);
      return;
    }
    setUnreachable(result.code === UNREACHABLE);
    const fields = Object.entries(result.fields ?? {});
    const known: Record<string, string> = {};
    let unmatched: string | null = null;
    for (const [name, message] of fields) {
      const mapped = SERVER_TO_FIELD[name];
      if (mapped) known[mapped] = message;
      else unmatched ??= message;
    }
    setServerErrors(result.code === "PRODUCT_SHARED" ? Object.fromEntries(Object.keys(known).map((k) => [k, listing.errors.PRODUCT_SHARED])) : known);
    const open = (Object.keys(known) as (keyof RowEditValues)[]).map((k) => FIELD_TO_PANEL[k]).find(Boolean);
    if (open) setPanel(open);
    // 칸 오류가 있으면 그 칸에(못 찾은 건 행 위), 없으면 코드별 문구 → 서버 문구
    setFormError(fields.length > 0 ? unmatched : (listing.errors[result.code] ?? result.message));
  };

  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const has = {
    description: values.description.trim() !== "",
    dataSheet: values.listingDataSheet !== "",
    photos: values.photos.length > 0,
    replaceProd: values.replaceProd !== "",
    testReport: values.testReport !== "",
    certificate: values.certificateOfAuthen !== "",
  };
  const panelCell = (p: Panel, label: string) => (
    <PanelButton on={has[p]} active={panel === p} label={label} error={panelError(p, errors)} onClick={() => toggle(p)} />
  );

  return (
    <section className="flex flex-col gap-2.5" aria-label={r.editing(detail.prodName)}>
      <div className="flex items-center gap-3 min-h-8.5">
        <p className="grow text-sm text-ink-2" aria-live="polite">
          <span className="font-bold text-ink">{r.editing(detail.prodName)}</span>
        </p>
        <div className="flex items-center gap-2">
          {!changed && <span className="text-xs text-ink-3">{r.noChange}</span>}
          <button
            type="button"
            onClick={() => void save()}
            disabled={!changed || anyUploading || saving || invalid}
            className="h-8.5 px-4 rounded-md bg-primary text-white text-sm font-bold hover:bg-primary-dark disabled:opacity-40 disabled:pointer-events-none"
          >
            {saving ? r.saving : r.save}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="h-8.5 px-3 rounded-md border border-line text-sm text-ink-2 hover:bg-bg disabled:opacity-40"
          >
            {r.cancel}
          </button>
        </div>
      </div>

      {formError && (
        <div role="alert" className="flex items-center gap-3 rounded-md border border-down/30 bg-down/5 px-3 py-2.5 text-[13px] text-down">
          <span className="grow">{formError}</span>
          {unreachable && !anyUploading && !saving && (
            <button type="button" onClick={() => void save()} className="shrink-0 font-semibold underline underline-offset-2">
              {r.retry}
            </button>
          )}
        </div>
      )}

      {/* 표의 한 행이 입력칸으로 바뀐 모양 — 열 순서는 검색 결과 표와 같다 */}
      <div className="rounded-md border border-line bg-surface overflow-x-auto">
        <table className="w-full min-w-334 table-fixed text-[13px]">
          <colgroup>
            <col className="w-48" />
            <col className="w-36" />
            <col className="w-32" />
            <col className="w-34" />
            <col className="w-40" />
            <col className="w-18" />
            <col className="w-20" />
            <col className="w-14" />
            <col className="w-28" />
            <col className="w-24" />
            <col className="w-16" />
            <col className="w-24" />
            <col className="w-22" />
          </colgroup>
          <thead className="bg-bg text-xs text-ink-2">
            <tr className="h-10 text-left">
              {[c.prodName, c.prodNo, c.brand, c.mufcDate, c.state, c.prodDescription, c.dataSheet, c.photo, my.mine.row.warranty, c.coverage, c.replaceProd, c.testReport, c.certificate].map(
                (label, i) => (
                  <th
                    key={label}
                    scope="col"
                    className={cn("px-2 font-medium", i === 0 && "sticky left-0 z-10 bg-bg pl-3 border-r border-line-2", i >= 5 && i <= 7 && "text-center", i >= 9 && "text-center")}
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              <td className="sticky left-0 z-10 bg-surface p-2 pl-3 border-r border-line-2">
                <Cell error={errors.prodName} id="re-prodName">
                  <input
                    id="re-prodName"
                    value={values.prodName}
                    onChange={(e) => set("prodName", e.target.value)}
                    maxLength={60}
                    aria-label={c.prodName}
                    aria-invalid={Boolean(errors.prodName)}
                    aria-describedby={errors.prodName ? "re-prodName-error" : undefined}
                    className={inputClass}
                  />
                </Cell>
              </td>
              <td className="p-2">
                <Cell error={errors.prodNo} id="re-prodNo">
                  <input
                    id="re-prodNo"
                    value={values.prodNo}
                    onChange={(e) => set("prodNo", e.target.value)}
                    maxLength={30}
                    aria-label={c.prodNo}
                    aria-invalid={Boolean(errors.prodNo)}
                    aria-describedby={errors.prodNo ? "re-prodNo-error" : undefined}
                    className={cn(inputClass, "font-mono")}
                  />
                </Cell>
              </td>
              <td className="p-2">
                <Cell error={errors.prodBrand} id="re-prodBrand">
                  <input
                    id="re-prodBrand"
                    value={values.prodBrand}
                    onChange={(e) => set("prodBrand", e.target.value)}
                    maxLength={60}
                    aria-label={c.brand}
                    aria-invalid={Boolean(errors.prodBrand)}
                    aria-describedby={errors.prodBrand ? "re-prodBrand-error" : undefined}
                    className={inputClass}
                  />
                </Cell>
              </td>
              <td className="p-2">
                <Cell error={errors.prodMufcDate} id="re-prodMufcDate">
                  <input
                    id="re-prodMufcDate"
                    type="date"
                    max={today}
                    value={values.prodMufcDate}
                    onChange={(e) => set("prodMufcDate", e.target.value)}
                    aria-label={c.mufcDate}
                    aria-invalid={Boolean(errors.prodMufcDate)}
                    aria-describedby={errors.prodMufcDate ? "re-prodMufcDate-error" : undefined}
                    className={cn(inputClass, "px-1.5 text-xs")}
                  />
                </Cell>
              </td>
              <td className="p-2">
                <Cell error={errors.prodState} id="re-prodState">
                  <select
                    id="re-prodState"
                    value={values.prodState}
                    onChange={(e) => set("prodState", e.target.value)}
                    aria-label={c.state}
                    aria-invalid={Boolean(errors.prodState)}
                    aria-describedby={errors.prodState ? "re-prodState-error" : undefined}
                    className={inputClass}
                  >
                    {/* 옛 형식 값이라 구간에 못 맞추면 빈 값 — 안 고르면 보내지 않아 서버 값이 그대로 남는다 */}
                    {values.prodState === "" && <option value="">{lf.prodStatePlaceholder}</option>}
                    {PROD_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Cell>
              </td>
              <td className="p-2 text-center">{panelCell("description", c.prodDescription)}</td>
              <td className="p-2 text-center">{panelCell("dataSheet", c.dataSheet)}</td>
              <td className="p-2 text-center">{panelCell("photos", c.photo)}</td>
              <td className="p-2">
                <Cell error={errors.warrantyMonths} id="re-warranty">
                  <select
                    id="re-warranty"
                    value={values.warrantyMonths}
                    onChange={(e) => set("warrantyMonths", Number(e.target.value))}
                    aria-label={my.mine.row.warranty}
                    aria-invalid={Boolean(errors.warrantyMonths)}
                    aria-describedby={errors.warrantyMonths ? "re-warranty-error" : undefined}
                    className={inputClass}
                  >
                    {WARRANTY_MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m === 0 ? le.warrantyNone : le.warrantyMonths(m)}
                      </option>
                    ))}
                  </select>
                </Cell>
              </td>
              <td className="p-2">
                <Cell error={errors.warrantyCoverage} id="re-coverage">
                  <select
                    id="re-coverage"
                    value={values.warrantyCoverage}
                    onChange={(e) => set("warrantyCoverage", e.target.value)}
                    aria-label={c.coverage}
                    aria-invalid={Boolean(errors.warrantyCoverage)}
                    aria-describedby={errors.warrantyCoverage ? "re-coverage-error" : undefined}
                    className={inputClass}
                  >
                    {WARRANTY_COVERAGES.map((v) => (
                      <option key={v} value={v}>
                        {v === "" ? le.coverageNone : v}
                      </option>
                    ))}
                  </select>
                </Cell>
              </td>
              <td className="p-2 text-center">{panelCell("replaceProd", c.replaceProd)}</td>
              <td className="p-2 text-center">{panelCell("testReport", c.testReport)}</td>
              <td className="p-2 text-center">{panelCell("certificate", c.certificate)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 행 아래 빈 공간: 누른 항목의 폼만 보인다. 업로더 상태가 사라지지 않게 전부 그려 두고 숨긴다 */}
      <div className={cn("rounded-md border border-line bg-surface p-4", panel === null && "hidden")}>
        <div className={cn(panel !== "description" && "hidden")}>
          <label htmlFor="re-description" className="block mb-1.5 text-[13px] text-ink-2">
            {lf.description}
            <span className="ml-1 text-ink-3">({values.description.length}/{MAX_DESCRIPTION})</span>
          </label>
          <textarea
            id="re-description"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            placeholder={lf.descriptionPlaceholder}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? "re-description-error" : undefined}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 aria-invalid:border-down"
          />
          {errors.description && (
            <p id="re-description-error" role="alert" className="mt-1 text-xs text-down">
              {errors.description}
            </p>
          )}
        </div>

        <div className={cn(panel !== "dataSheet" && "hidden")}>
          <SingleFileUploader
            uploadKind="listing-datasheet"
            checkKind="pdf"
            label={lf.datasheet}
            hint={lf.datasheetHint}
            pickLabel={lf.datasheetPick}
            removeLabel={lf.datasheetRemove}
            value={values.listingDataSheet}
            initialKey={initial.listingDataSheet || undefined}
            onChange={(key) => set("listingDataSheet", key)}
            onUploadingChange={setUploadingOf("listingDataSheet")}
            onProblemChange={problemSetters.listingDataSheet}
            error={errors.listingDataSheet}
          />
        </div>

        <div className={cn(panel !== "photos" && "hidden")}>
          <PhotoUploader
            value={values.photos}
            initialKeys={initial.photos}
            onChange={setPhotos}
            onUploadingChange={setPhotosUploading}
            onProblemChange={problemSetters.photos}
            error={errors.photos}
          />
        </div>

        {(Object.keys(FILE_PANELS) as (keyof typeof FILE_PANELS)[]).map((p) => {
          const spec = FILE_PANELS[p];
          return (
            <div key={p} className={cn(panel !== p && "hidden")}>
              <SingleFileUploader
                uploadKind={spec.uploadKind}
                checkKind="doc"
                label={spec.label}
                hint={le.docHint}
                pickLabel={le.filePick}
                removeLabel={le.fileRemove(spec.label)}
                value={values[spec.field]}
                initialKey={initial[spec.field] || undefined}
                onChange={(key) => set(spec.field, key)}
                onUploadingChange={setUploadingOf(spec.field)}
                onProblemChange={problemSetters[spec.field]}
                error={errors[spec.field]}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function panelError(p: Panel, errors: Record<string, string>): boolean {
  const field = Object.entries(FIELD_TO_PANEL).find(([, panel]) => panel === p)?.[0];
  return Boolean(field && errors[field]);
}

/** 칸 아래 오류 문구 (칸 id 로 aria-describedby) */
function Cell({ error, id, children }: { error?: string; id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[11px] leading-snug text-down">
          {error}
        </p>
      )}
    </div>
  );
}

/** 파일·긴 글 칸. 있으면 "입력됨", 없으면 "없음". 누르면 행 아래에 그 항목 폼 */
function PanelButton({ on, active, label, error, onClick }: { on: boolean; active: boolean; label: string; error: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      aria-label={`${label} ${on ? r.panelHas : r.panelNone}`}
      className={cn(
        "h-8.5 min-w-12 px-2 rounded-md border text-xs font-medium",
        error ? "border-down text-down" : active ? "border-primary bg-primary-soft text-primary-dark" : on ? "border-line text-primary hover:border-primary" : "border-line text-ink-3 hover:border-primary",
      )}
    >
      {on ? r.panelHas : r.panelNone}
    </button>
  );
}
