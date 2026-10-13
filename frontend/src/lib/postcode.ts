// 카카오(다음) 우편번호 서비스 (사용자 승인 2026-10-13). 키 없이 무료, 외부 스크립트 하나를 필요할 때만 불러온다.
// https://postcode.map.daum.net/guide

const SCRIPT_SRC = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

export interface PostcodeResult {
  roadAddress: string;
  jibunAddress: string;
  zonecode: string;
}

interface PostcodeInstance {
  embed: (element: HTMLElement, options?: { autoClose?: boolean }) => void;
}

interface DaumGlobal {
  Postcode: new (options: { oncomplete: (data: PostcodeResult) => void; width?: string; height?: string }) => PostcodeInstance;
}

declare global {
  interface Window {
    daum?: DaumGlobal;
  }
}

let loading: Promise<DaumGlobal> | null = null;

/** 스크립트를 한 번만 불러온다. 실패하면 다음 호출에서 다시 시도 */
export function loadPostcode(): Promise<DaumGlobal> {
  if (window.daum?.Postcode) return Promise.resolve(window.daum);
  loading ??= new Promise<DaumGlobal>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.daum?.Postcode ? resolve(window.daum) : reject(new Error("postcode")));
    script.onerror = () => {
      script.remove();
      reject(new Error("postcode"));
    };
    document.head.appendChild(script);
  }).catch((e: unknown) => {
    loading = null;
    throw e;
  });
  return loading;
}

/** 도로명 주소 우선, 없으면 지번 */
export function pickAddress(data: PostcodeResult): string {
  return data.roadAddress || data.jibunAddress;
}

/** 저장할 한 줄 주소. 상세주소가 비면 기본 주소만 (users.user_address 200자 한 칸) */
export function joinAddress(base: string, detail: string): string {
  return [base.trim(), detail.trim()].filter(Boolean).join(" ");
}
