interface BarAction {
  label: string;
  disabled: boolean;
  onClick: () => void;
}

/**
 * 다량 등록·대량구매 페이지의 아래 고정 줄. 화면 아래에 떠 있는 카드(테두리 + 그림자)로, 왼쪽에 "체크 N건 · 처리할 수 있는 N건" 요약,
 * 오른쪽에 [선택한 N건 …](주 버튼)·[모두 …](보조 버튼)을 둔다. 좁은 칸에서는 요약이 위, 버튼 둘이 같은 너비로 아래에 나란히 놓인다
 */
export function BulkActionBar({ summary, primary, secondary }: { summary: string; primary: BarAction; secondary: BarAction }) {
  return (
    <div className="sticky bottom-2 z-10 flex flex-col gap-2 rounded-md border border-line bg-surface p-3 shadow-md @md:flex-row @md:items-center">
      <p className="tabular-nums text-[13px] text-ink-2 @md:flex-1">{summary}</p>
      <div className="grid grid-cols-2 gap-2 @md:flex">
        <button
          type="button"
          onClick={primary.onClick}
          disabled={primary.disabled}
          className="min-h-10 rounded-md bg-primary px-5 py-1.5 text-[14px] font-bold leading-tight text-white hover:bg-primary-dark disabled:opacity-40"
        >
          {primary.label}
        </button>
        <button
          type="button"
          onClick={secondary.onClick}
          disabled={secondary.disabled}
          className="min-h-10 rounded-md border border-primary px-5 py-1.5 text-[14px] font-bold leading-tight text-primary hover:bg-primary-soft disabled:opacity-40"
        >
          {secondary.label}
        </button>
      </div>
    </div>
  );
}
