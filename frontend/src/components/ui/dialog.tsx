"use client"

import * as React from "react"
import { cn } from "cn"
import { Dialog as DialogPrimitive } from "radix-ui"

// shadcn/ui dialog 에서 지금 쓰는 부분만 (가입 결과 팝업). radix-ui 는 이미 의존성에 있다

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

// 보조·홈 칸(iframe) 안에서 모달이 열려 있는 동안 부모에게 알려, 그 iframe 을 창 전체에 투명하게 덮게 한다 (사용자 지시 2026-11-02:
// 어느 칸에서 열든 모달은 창 가운데, 레이아웃은 그대로). 부모가 보내 주는 칸 위치(modal-rect)에 이 문서의 body 를 그대로 앉혀
// 칸 내용은 제자리에 보이고, 어두운 막·모달만 창 전체에 뜬다. 겹쳐 열린 모달(구매 → 결과 팝업)은 개수로 세어 처음 열릴 때·마지막으로 닫힐 때만 알린다
let openModals = 0
function reportModal(open: boolean) {
  if (typeof window === "undefined" || window.self === window.top) return
  window.top?.postMessage({ source: "market-tile", type: "modal", open }, window.location.origin)
}
// 모달 내용 안에 두는 보고자 — Radix 가 닫히면 내용을 지우므로(Presence) 이 컴포넌트도 같이 사라진다. DialogContent 자신에 훅을 두면
// 닫혀도 계속 마운트돼 있어 닫힘을 못 알린다
function ModalOpenReporter() {
  React.useEffect(() => {
    const root = document.documentElement
    const onRect = (e: MessageEvent) => {
      if (e.source !== window.top || e.data?.source !== "market-tile" || e.data.type !== "modal-rect") return
      const r = e.data.rect as { x: number; y: number; width: number; height: number }
      root.style.setProperty("--modal-x", `${r.x}px`)
      root.style.setProperty("--modal-y", `${r.y}px`)
      root.style.setProperty("--modal-w", `${r.width}px`)
      root.style.setProperty("--modal-h", `${r.height}px`)
      root.dataset.modalOpen = ""
    }
    window.addEventListener("message", onRect)
    if (openModals++ === 0) reportModal(true)
    return () => {
      window.removeEventListener("message", onRect)
      if (--openModals === 0) {
        delete root.dataset.modalOpen
        reportModal(false)
      }
    }
  }, [])
  return null
}

function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-black/40 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm max-h-[calc(100dvh-1rem)] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-md border border-line bg-surface p-6 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        <ModalOpenReporter />
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn("text-[17px] font-bold", className)} {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description data-slot="dialog-description" className={cn("text-[14px] leading-relaxed text-ink-2", className)} {...props} />
}

export { Dialog, DialogContent, DialogDescription, DialogTitle }
