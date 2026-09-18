// 백엔드 연결 전까지 홈에 보여줄 샘플. API 붙이면 삭제.
import type { ListingSummary } from "@/types/listing";

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export const categories = [
  "서버", "워크스테이션", "GPU", "CPU", "메모리", "스토리지",
  "네트워크", "랙·UPS", "라이선스", "모니터·주변기기", "노트북·PC", "기타",
];

export const popularQueries = [
  "R740", "RTX 4090", "Catalyst 9300", "PM9A3 3.84TB", "DL380 Gen10", "Windows Server 2022", "DDR4 ECC 32GB",
];

export const buyRequests: ListingSummary[] = [
  { id: "b1", type: "buy", title: "RTX 4090 24GB 5장 (신품·중고 무관)", category: "GPU", quantity: 5, price: 2_300_000, priceUnit: "/장", sellerKind: "business", createdAt: minutesAgo(2) },
  { id: "b2", type: "buy", title: "DDR4 ECC RDIMM 32GB 2933 ×16 (R740 증설)", category: "메모리", quantity: 16, price: 85_000, priceUnit: "/개", sellerKind: "business", createdAt: minutesAgo(9) },
  { id: "b3", type: "buy", title: "10G SFP+ 광모듈 ×20 (Cisco 호환)", category: "네트워크", quantity: 20, price: null, sellerKind: "individual", createdAt: minutesAgo(14) },
  { id: "b4", type: "buy", title: "Microsoft 365 E3 50석 연간", category: "라이선스", quantity: 50, price: null, sellerKind: "business", createdAt: minutesAgo(31) },
  { id: "b5", type: "buy", title: "Synology 8베이 NAS (DS1821+ 급)", category: "스토리지", quantity: 1, price: 1_100_000, sellerKind: "individual", createdAt: minutesAgo(65) },
  { id: "b6", type: "buy", title: "42U 서버랙 ×2 (수도권 직접 수거)", category: "랙·UPS", quantity: 2, price: 400_000, priceUnit: "/대", sellerKind: "business", createdAt: minutesAgo(130) },
];

export const sellListings: ListingSummary[] = [
  { id: "s1", type: "sell", title: "Dell PowerEdge R740 2U · Silver 4210 ×2 · 64GB", category: "서버", quantity: 1, price: 3_500_000, sellerKind: "business", createdAt: minutesAgo(1) },
  { id: "s2", type: "sell", title: "NVIDIA RTX 4090 24GB (MSI Gaming X) · 잔여보증 14개월", category: "GPU", quantity: 2, price: 2_450_000, sellerKind: "individual", createdAt: minutesAgo(6) },
  { id: "s3", type: "sell", title: "Cisco Catalyst 9300 48P PoE+ (C9300-48P-E)", category: "네트워크", quantity: 3, price: 1_900_000, priceUnit: "/대", sellerKind: "business", createdAt: minutesAgo(12) },
  { id: "s4", type: "sell", title: "Samsung PM9A3 3.84TB U.2 NVMe · 신품 미개봉", category: "스토리지", quantity: 4, price: 620_000, priceUnit: "/개", sellerKind: "business", createdAt: minutesAgo(25) },
  { id: "s5", type: "sell", title: "Windows Server 2022 Standard 16코어 (양도 가능)", category: "라이선스", quantity: 1, price: 890_000, sellerKind: "individual", createdAt: minutesAgo(48) },
  { id: "s6", type: "sell", title: "APC Smart-UPS SRT 3000VA · 배터리 교체 완료", category: "랙·UPS", quantity: 1, price: 750_000, sellerKind: "business", createdAt: minutesAgo(70) },
];
