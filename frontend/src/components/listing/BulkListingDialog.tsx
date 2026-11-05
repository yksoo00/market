"use client";

import { useReducer, useRef, useState, type DragEvent } from "react";
import { useTileOpen } from "@/components/common/TileWorkspaceContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { listingBulkApi } from "@/lib/api/listings";
import { bulkReducer, canSelect, errorsOf, initialBulkState, summary, toApiRow, type BulkAction, type BulkLine, type BulkState } from "@/lib/bulkListing";
import { todayInSeoul } from "@/lib/listingForm";
import { BULK_INPUT_FIELDS, isXlsx, type BulkFields, type BulkInputField } from "@/lib/validation/bulkListing";
import { PROD_STATES } from "@/lib/validation/listing";
import { checkUpload } from "@/lib/validation/upload";
import { cn } from "@/lib/utils";
import { listing } from "@/messages/listing";
import type { BulkCandidate, BulkResult } from "@/types/listingBulk";

const t = listing.bulk;

type Step = "pick" | "reading" | "table";

const inputClass =
  "h-8 w-full min-w-0 rounded-md border border-line bg-surface px-2 text-[13px] text-ink outline-none focus-visible:border-primary aria-invalid:border-down";

// 칸 하나가 차지하는 너비. 상품명·설명은 넓게
const wideFields: BulkInputField[] = ["prodName", "description"];

interface Props {
  onClose: () => void;
}

/**
 * 엑셀 판매상품 다량 등록 (계획 2026-11-05-bulk-listing-excel.md). 모달 하나 안에서 올리기 → 검사 결과 → 확정.
 * 서버는 줄 상태를 저장하지 않는다 — 수정·체크는 여기(bulkReducer)에 있고 검사·확정 때마다 줄을 전부 다시 보낸다.
 * 부모가 열 때만 이 컴포넌트를 그려서, 열 때마다 상태가 새로 시작한다
 */
export function BulkListingDialog({ onClose }: Props) {
  const [state, dispatch] = useReducer(bulkReducer, initialBulkState);
  const [step, setStep] = useState<Step>("pick");
  const [pickError, setPickError] = useState<string | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // 마지막 검사 뒤에 고친 줄. 칸을 벗어날 때 이 줄만 서버에 다시 묻는다 (고치지 않고 지나가기만 하면 묻지 않는다)
  const edited = useRef(new Set<number>());
  const openTile = useTileOpen();
  const today = todayInSeoul();

  const stat = summary(state.lines);

  // 줄을 서버에 다시 물어본다. base 는 방금 낸 수정이 이미 들어간 상태 (이 렌더의 state 에는 아직 없으므로 호출한 쪽이 리듀서로 먼저 계산).
  // 응답 전엔 그 줄을 체크할 수 없다 (checking). 네트워크 실패면 이전 결과를 그대로 두고 체크만 풀린 채 둔다 — 칸을 다시 벗어나면 재시도
  const recheckRows = async (base: BulkState, rowNos: number[]) => {
    const wanted = new Set(rowNos);
    const lines = base.lines.filter((l) => wanted.has(l.rowNo));
    if (lines.length === 0) return;
    lines.forEach((l) => dispatch({ type: "checking", rowNo: l.rowNo }));
    const res = await listingBulkApi.check(lines.map(toApiRow));
    dispatch({ type: "rechecked", results: res.ok ? res.data.results : lines.map((l) => l.result) });
    if (!res.ok) setTopError(res.fields ? Object.values(res.fields).join(" ") : (listing.errors[res.code] ?? res.message));
  };

  const edit = (rowNo: number, field: keyof BulkFields, value: string, immediate: boolean) => {
    const action: BulkAction = { type: "edited", rowNo, field, value, today };
    dispatch(action);
    // 목록에서 고르는 칸은 고르는 순간 끝난 입력이라 바로 검사하고, 글자 입력 칸은 벗어날 때 검사한다
    if (immediate) void recheckRows(bulkReducer(state, action), [rowNo]);
    else edited.current.add(rowNo);
  };

  const blurLine = (rowNo: number) => {
    if (edited.current.delete(rowNo)) void recheckRows(state, [rowNo]);
  };

  const pick = (rowNo: number, candidate: BulkCandidate) => {
    const action: BulkAction = { type: "picked", rowNo, candidate };
    dispatch(action);
    void recheckRows(bulkReducer(state, action), [rowNo]);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setPickError(null);
    const error = !isXlsx(file) ? t.drop.notXlsx : checkUpload("excel", file);
    if (error) {
      setPickError(error);
      return;
    }
    setStep("reading");
    const res = await listingBulkApi.parse(file);
    if (!res.ok) {
      setStep("pick");
      setPickError(res.fields?.file ?? (listing.errors[res.code] ?? res.message ?? t.readFailed));
      return;
    }
    if (res.data.rows.length === 0) {
      setStep("pick");
      setPickError(t.emptyFile);
      return;
    }
    dispatch({ type: "loaded", rows: res.data.rows, results: res.data.results });
    setTopError(null);
    setStep("table");
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 1) {
      setPickError(t.drop.onlyOne);
      return;
    }
    void upload(e.dataTransfer.files[0]);
  };

  const downloadTemplate = async () => {
    const res = await listingBulkApi.template();
    if (!res.ok) {
      setPickError(t.drop.templateFailed);
      return;
    }
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "판매상품_다량등록_양식.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  // 선택 확정 = 체크한 줄, 전체 확정 = 오류 없는 줄 전부
  const commit = async (lines: BulkLine[]) => {
    if (lines.length === 0) return;
    const rows = lines.map(toApiRow);
    if (!window.confirm(t.confirm(rows.length, lines.filter((l) => l.result.status === "NEW_MASTER").length))) return;
    setCommitting(true);
    setTopError(null);
    const res = await listingBulkApi.commit(rows);
    setCommitting(false);
    if (res.ok) {
      dispatch({ type: "committed", rowNos: rows.map((r) => r.rowNo) });
      return;
    }
    setTopError(listing.errors[res.code] ?? res.message);
    // 서버가 걸러 낸 줄의 사유를 표에 올린다 — 선택한 줄을 전부 다시 검사
    if (res.code === "LISTING_BULK_INVALID") void recheckRows(state, rows.map((r) => r.rowNo));
  };

  const close = () => {
    const dirty = state.lines.some((l) => l.dirty);
    if (dirty && !window.confirm(t.closeConfirm)) return;
    onClose();
  };

  const groups = {
    ok: state.lines.filter((l) => l.group === "ok"),
    failed: state.lines.filter((l) => l.group === "failed"),
  };

  return (
    <Dialog open onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-5xl flex flex-col gap-4 [@media(max-height:640px)]:gap-3 [@media(max-height:640px)]:p-4">
        <div className="flex flex-col gap-1">
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription className="text-[13px]">{t.desc}</DialogDescription>
        </div>

        {step !== "table" && (
          <div className="flex flex-col gap-3">
            <div
              role="button"
              tabIndex={0}
              aria-label={t.drop.zone}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-line px-4 py-8 text-center outline-none focus-visible:border-primary",
                dragging && "border-primary bg-primary-soft",
              )}
            >
              {step === "reading" ? (
                <p aria-busy="true" className="text-[15px] font-bold text-ink">
                  {t.reading}
                </p>
              ) : (
                <>
                  <p className="text-[15px] font-bold text-ink">{t.drop.prompt}</p>
                  <p className="text-[13px] text-ink-2">{t.drop.or}</p>
                  <span className="h-9 px-4 inline-flex items-center rounded-md border border-primary text-[13px] font-bold text-primary">{t.drop.pick}</span>
                  <p className="text-[12px] text-ink-3">{t.drop.hint}</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = ""; // 같은 파일을 다시 골라도 change 가 나게
                void upload(file);
              }}
            />
            {pickError && (
              <p role="alert" className="text-[13px] text-down">
                {pickError}
              </p>
            )}
            <button type="button" onClick={() => void downloadTemplate()} className="self-start text-[13px] font-medium text-primary underline underline-offset-2">
              {t.drop.template}
            </button>
          </div>
        )}

        {step === "table" && (
          <>
            {state.created > 0 && (
              <p role="status" className="text-[13px] font-semibold text-ink">
                {t.done(state.created)} {state.lines.length > 0 ? t.remaining(state.lines.length) : t.allDone}
              </p>
            )}
            {topError && (
              <p role="alert" className="text-[13px] text-down">
                {topError}
              </p>
            )}
            {state.lines.length > 0 && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="num text-[13px] text-ink-2">{t.summary(stat.ok, stat.failed, stat.selected)}</span>
                  <span className="ml-auto flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "selectAll", value: true })}
                      className="h-8 px-3 rounded-md border border-line text-[13px] font-medium text-ink-2 hover:bg-bg"
                    >
                      {t.actions.selectAll}
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "selectAll", value: false })}
                      className="h-8 px-3 rounded-md border border-line text-[13px] font-medium text-ink-2 hover:bg-bg"
                    >
                      {t.actions.clearAll}
                    </button>
                  </span>
                </div>
                <div className="max-h-[55vh] overflow-y-auto flex flex-col gap-4 pr-1">
                  {groups.ok.length > 0 && (
                    <Section title={t.okTitle(groups.ok.length)}>
                      {groups.ok.map((line) => (
                        <LineCard key={line.rowNo} line={line} dispatch={dispatch} onEdit={edit} onBlurLine={blurLine} onPick={pick} />
                      ))}
                    </Section>
                  )}
                  {groups.failed.length > 0 && (
                    <Section title={t.failedTitle(groups.failed.length)}>
                      {groups.failed.map((line) => (
                        <LineCard key={line.rowNo} line={line} dispatch={dispatch} onEdit={edit} onBlurLine={blurLine} onPick={pick} />
                      ))}
                    </Section>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void commit(state.lines.filter((l) => l.selected))}
                    disabled={committing || stat.selected === 0}
                    className="h-10 px-5 rounded-md bg-primary text-white text-[14px] font-bold hover:bg-primary-dark disabled:opacity-40"
                  >
                    {committing ? t.actions.committing : t.actions.commitSelected(stat.selected)}
                  </button>
                  <button
                    type="button"
                    onClick={() => void commit(state.lines.filter(canSelect))}
                    disabled={committing || stat.ok === 0}
                    className="h-10 px-5 rounded-md border border-primary text-primary text-[14px] font-bold hover:bg-primary-soft disabled:opacity-40"
                  >
                    {t.actions.commitAll(stat.ok)}
                  </button>
                </div>
              </>
            )}
            {state.lines.length === 0 && (
              <div className="flex flex-col items-start gap-2">
                <button
                  type="button"
                  onClick={() => {
                    openTile("/my/activity?tab=sales", false);
                    onClose();
                  }}
                  className="h-9 px-4 rounded-md border border-primary text-[13px] font-bold text-primary hover:bg-primary-soft"
                >
                  {t.viewMine}
                </button>
              </div>
            )}
          </>
        )}

        <div className="flex gap-2">
          {step === "table" && state.lines.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (state.lines.some((l) => l.dirty) && !window.confirm(t.closeConfirm)) return;
                setStep("pick");
              }}
              className="h-11 px-4 rounded-md border border-line text-[14px] font-medium text-ink-2 hover:bg-bg"
            >
              {t.retry}
            </button>
          )}
          <button type="button" onClick={close} className="h-11 flex-1 rounded-md border border-line text-[15px] font-medium text-ink-2 hover:bg-bg">
            {t.close}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[14px] font-bold text-ink">{title}</h3>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}

interface LineProps {
  line: BulkLine;
  dispatch: React.Dispatch<BulkAction>;
  onEdit: (rowNo: number, field: keyof BulkFields, value: string, immediate: boolean) => void;
  onBlurLine: (rowNo: number) => void;
  onPick: (rowNo: number, candidate: BulkCandidate) => void;
}

function LineCard({ line, dispatch, onEdit, onBlurLine, onPick }: LineProps) {
  const errors = errorsOf(line);
  const failed = Object.keys(errors).length > 0;
  const status = line.result.status;
  const badge = failed ? t.line.failed : status === "NEW_MASTER" ? t.line.newMaster : t.line.matched;

  return (
    <li className={cn("rounded-md border", failed ? "border-down" : "border-line")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-2 bg-bg px-3 py-2">
        <Checkbox
          checked={line.selected}
          disabled={!canSelect(line)}
          onCheckedChange={() => dispatch({ type: "toggled", rowNo: line.rowNo })}
          aria-label={t.line.select(line.rowNo)}
        />
        <span className="num text-[13px] font-semibold text-ink">{t.line.row(line.rowNo)}</span>
        <span className={cn("rounded px-1.5 py-0.5 text-[12px] font-bold", failed ? "bg-down/10 text-down" : status === "NEW_MASTER" ? "bg-primary-soft text-primary" : "bg-green-soft text-green")}>
          {badge}
        </span>
        {!failed && status === "MATCHED" && line.result.matchedName && <span className="text-[13px] text-ink-2">{t.line.matchedAs(line.result.matchedName)}</span>}
        {line.checking && (
          <span aria-busy="true" className="text-[12px] text-ink-3">
            {t.line.checking}
          </span>
        )}
        {line.result.notices.map((n) => (
          <span key={n} className="text-[12px] text-ink-3">
            {n}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 p-3 md:grid-cols-4">
        {BULK_INPUT_FIELDS.map((field) => (
          <label key={field} className={cn("flex min-w-0 flex-col gap-1", wideFields.includes(field) && "col-span-2")}>
            <span className="text-[12px] text-ink-2">{t.fields[field]}</span>
            {field === "prodState" ? (
              <select
                value={line.fields[field]}
                aria-invalid={field in errors}
                className={inputClass}
                onChange={(e) => onEdit(line.rowNo, field, e.target.value, true)}
              >
                <option value="">{t.stateSelect}</option>
                {PROD_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={line.fields[field]}
                aria-invalid={field in errors}
                className={inputClass}
                inputMode={["salesUnitPrice", "salesQuantity", "minOrderQuantity", "orderUnit"].includes(field) ? "numeric" : undefined}
                onChange={(e) => onEdit(line.rowNo, field, e.target.value, false)}
                // 칸을 벗어날 때 그 줄만 서버가 다시 검사한다 (상품 칸이면 마스터도 다시 찾는다)
                onBlur={() => onBlurLine(line.rowNo)}
              />
            )}
            {field in errors && (
              <span role="alert" className="text-[12px] text-down">
                {errors[field]}
              </span>
            )}
          </label>
        ))}
      </div>
      {/* 서버가 칸에 못 붙인 사유(prodId 등) */}
      {Object.entries(errors)
        .filter(([key]) => !(BULK_INPUT_FIELDS as readonly string[]).includes(key))
        .map(([key, message]) => (
          <p key={key} role="alert" className="px-3 pb-2 text-[12px] text-down">
            {t.fields[key] ?? key}: {message}
          </p>
        ))}
      <Candidates result={line.result} onPick={(c) => onPick(line.rowNo, c)} newMaster={status === "NEW_MASTER"} />
    </li>
  );
}

function Candidates({ result, onPick, newMaster }: { result: BulkResult; onPick: (c: BulkResult["candidates"][number]) => void; newMaster: boolean }) {
  if (result.candidates.length === 0 && !newMaster) return null;
  return (
    <div className="flex flex-col gap-1 border-t border-line-2 px-3 py-2">
      {newMaster && <p className="text-[12px] text-ink-2">{t.line.newMasterHint}</p>}
      {result.candidates.length > 0 && (
        <>
          <p className="text-[12px] font-semibold text-ink">{t.line.candidates}</p>
          <ul className="flex flex-wrap gap-2">
            {result.candidates.map((c) => (
              <li key={c.prodId}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className="h-7 rounded-md border border-line px-2 text-[12px] text-ink hover:bg-bg"
                >
                  {t.line.pickCandidate(c.prodName, c.prodBrand)}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
