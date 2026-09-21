import { cn } from "cn";

interface Props {
  steps: string[];
  /** 0부터 */
  current: number;
}

/** 가입 진행 표시. 지난 단계 primary, 현재 굵게, 남은 단계 흐리게 */
export function SignupSteps({ steps, current }: Props) {
  return (
    <ol className="flex items-center gap-2 px-1 text-xs">
      {steps.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            aria-current={i === current ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5",
              i < current && "text-primary",
              i === current && "font-bold text-ink",
              i > current && "text-ink-3",
            )}
          >
            <span
              className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center num text-[11px] font-semibold",
                i <= current ? "bg-primary text-white" : "bg-line-2 text-ink-3",
              )}
            >
              {i + 1}
            </span>
            {label}
          </span>
          {i < steps.length - 1 && <span className="w-4 border-t border-line" />}
        </li>
      ))}
    </ol>
  );
}
