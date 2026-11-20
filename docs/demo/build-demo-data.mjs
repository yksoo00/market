// 시연용 데이터 엑셀 생성기. 의존성 없음 (node 만 있으면 된다).
//
//   node docs/demo/build-demo-data.mjs [--date 2026-11-25] [--uid-date 2026-11-24] [--uid-start 1] [--out docs/demo/data]
//
// --date      시연하는 날(한국). 등록일·납품일·거래일이 이 날짜 기준으로 만들어진다. 기본 = 오늘.
// --uid-date  임시 테이블에서 "사용자 정보" 엑셀을 가져오는 날. 서버가 uid 를 그날 날짜로 새로 만들기 때문에(UP+yyMMdd+일련번호)
//             다른 시트가 가리키는 uid 도 같은 날짜여야 한다. 기본 = 오늘. 가져오는 날이 바뀌면 다시 만든다.
// --uid-start 그날 이미 가입한 사용자가 있어 일련번호가 1 이 아니라면 첫 번호 (예: 오늘 이미 3명 → 4).
//
// 데이터는 전부 가상이다 (회사·사람·사업자번호·전화·이메일). 제조사·모델명만 실제 제품 이름이다.
// 장바구니·비교용(trd_cart_info) 행은 만들지 않는다 — 장바구니는 1시간 뒤 자동 삭제되며 삭제할 때 재고를 되돌려 주므로(CartService.EXPIRE_AFTER)
// 엑셀로 넣어 두면 재고가 어긋난다. 시연에서 직접 담는다.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { crc32 } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// ───────────────────────── 인자 ─────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => (cur.startsWith("--") ? [...acc, [cur.slice(2), all[i + 1]]] : acc), []),
);
const today = new Date();
const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
const DEMO_DAY = args.date ?? todayIso;
const UID_DAY = args["uid-date"] ?? todayIso;
const UID_START = Number(args["uid-start"] ?? 1);
const OUT = resolve(args.out ?? join(here, "data"));
const DEMO_PASSWORD = "Demo1234!@"; // 평문으로 넣으면 서버가 bcrypt 로 바꿔 저장한다 (DevTableService.hashIfPlainPassword)

for (const [name, v] of [["--date", DEMO_DAY], ["--uid-date", UID_DAY]]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new Error(`${name} 는 YYYY-MM-DD 여야 합니다: ${v}`);
}

// ───────────────────────── 시간 도구 (한국 시간을 그대로 다루는 단순 계산) ─────────────────────────
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const dayStart = Date.parse(`${DEMO_DAY}T00:00:00Z`); // 시연일 00:00 (시간대 없이 숫자로만 쓴다)
const p2 = (n) => String(n).padStart(2, "0");
const parts = (ms) => {
  const d = new Date(ms);
  return { y: d.getUTCFullYear(), M: p2(d.getUTCMonth() + 1), d: p2(d.getUTCDate()), h: p2(d.getUTCHours()), m: p2(d.getUTCMinutes()), s: p2(d.getUTCSeconds()) };
};
const ts14 = (ms) => {
  const t = parts(ms);
  return `${t.y}${t.M}${t.d}${t.h}${t.m}${t.s}`;
};
const date8 = (ms) => ts14(ms).slice(0, 8);
const uidPrefix = `UP${UID_DAY.slice(2, 4)}${UID_DAY.slice(5, 7)}${UID_DAY.slice(8, 10)}`;

// ───────────────────────── 사용자 (가상) ─────────────────────────
// 순서가 곧 uid 일련번호다 (가져오는 순서대로 UP…001, 002 …).
const USERS = [
  { key: "hanbit", loginId: "hanbit01", cls: "business", name: "김도현", phone: "01055501001", email: "hanbit01@example.com", address: "서울특별시 금천구 가산디지털1로 100",
    bus: "1018100001", company: "한빛정보통신(주)", open: "20120305", tel: "0221001001", companyAddress: "서울특별시 금천구 가산디지털1로 100", role: "서버·스토리지 중고 총판 (판매자)" },
  { key: "netone", loginId: "netone01", cls: "business", name: "이재훈", phone: "01055501002", email: "netone01@example.com", address: "경기도 성남시 분당구 판교로 200",
    bus: "1058100002", company: "넷원시스템", open: "20150720", tel: "0319001002", companyAddress: "경기도 성남시 분당구 판교로 200", role: "네트워크·보안 장비 (판매자)" },
  { key: "pcmaru", loginId: "pcmaru01", cls: "business", name: "박상우", phone: "01055501003", email: "pcmaru01@example.com", address: "서울특별시 용산구 한강대로 300",
    bus: "1078100003", company: "피씨마루", open: "20100811", tel: "0224001003", companyAddress: "서울특별시 용산구 한강대로 300", role: "PC·모니터·부품 (판매자)" },
  { key: "daon", loginId: "daon01", cls: "business", name: "최은지", phone: "01055501004", email: "daon01@example.com", address: "인천광역시 연수구 송도과학로 50",
    bus: "2118100004", company: "다온소프트(주)", open: "20190102", tel: "0328001004", companyAddress: "인천광역시 연수구 송도과학로 50", role: "사무실 이전·서버실 구축 중인 기업 (구매자)" },
  { key: "seoyeon", loginId: "seoyeon01", cls: "personal", name: "한서연", phone: "01055501005", email: "seoyeon01@example.com", address: "서울특별시 마포구 월드컵북로 10",
    nickname: "서연", role: "개인 구매자 (SSD·노트북)" },
  { key: "minjun", loginId: "minjun01", cls: "personal", name: "박민준", phone: "01055501006", email: "minjun01@example.com", address: "경기도 수원시 영통구 광교로 20",
    nickname: "중고IT민준", role: "개인 판매자 (쓰던 장비 처분)" },
  { key: "jiwoo", loginId: "jiwoo01", cls: "personal", name: "최지우", phone: "01055501007", email: "jiwoo01@example.com", address: "부산광역시 해운대구 센텀중앙로 30",
    nickname: null, role: "개인 구매자 (모니터·견적)" },
];
USERS.forEach((u, i) => {
  u.uid = `${uidPrefix}${String(UID_START + i).padStart(3, "0")}`;
  u.dtReg = ts14(dayStart - (60 - i * 3) * DAY + 9 * HOUR + i * 7 * MIN);
});
const U = Object.fromEntries(USERS.map((u) => [u.key, u]));

// ───────────────────────── 상품 마스터 (실제 제품명, 가상 판매자) ─────────────────────────
// 물품분류번호(classNo)는 시연용 예시 값이다 (실제 조달청 코드와 다를 수 있음).
// cat = 카테고리 소분류 경로. trd_ctgr_code 에 이미 시드로 들어 있는 값만 쓴다.
const M = [
  // ── 한빛정보통신: 서버·스토리지
  { k: "r650", name: "PowerEdge R650 1U 랙마운트 서버", brand: "Dell", part: "R650", cls: "43211501", cat: "E02-F06-G017", spec: "Xeon Silver 4314 x2 / 128GB / SAS 2.4TB x2", life: 36 },
  { k: "dl380", name: "ProLiant DL380 Gen10 Plus 2U 서버", brand: "HPE", part: "DL380 Gen10 Plus", cls: "43211501", cat: "E02-F06-G018", spec: "Xeon Silver 4310 x1 / 64GB / SAS 1.8TB x4", life: 36 },
  { k: "sr650", name: "ThinkSystem SR650 2U 서버", brand: "Lenovo", part: "7X06", cls: "43211501", cat: "E02-F06-G018", spec: "Xeon Silver 4210 x2 / 96GB / SAS 1.2TB x4", life: 24 },
  { k: "r750", name: "PowerEdge R750 2U 랙마운트 서버", brand: "Dell", part: "R750", cls: "43211501", cat: "E02-F06-G018", spec: "Xeon Gold 5318Y x2 / 128GB / NVMe 3.84TB x2", life: 36 },
  { k: "t350", name: "PowerEdge T350 타워 서버", brand: "Dell", part: "T350", cls: "43211501", cat: "E02-F07-G021", spec: "Xeon E-2334 / 32GB / SATA 2TB x2", life: 36 },
  { k: "rdimm", name: "32GB DDR4-3200 ECC RDIMM", brand: "Samsung", part: "M393A4K40EB3-CWE", cls: "43201401", cat: "E02-F08-G025", spec: "DDR4-3200 / 2Rx4 / ECC Registered", life: 36 },
  { k: "ds1621", name: "DiskStation DS1621+ NAS 6베이", brand: "Synology", part: "DS1621+", cls: "43201800", cat: "E03-F10-G031", spec: "6베이 / Ryzen V1500B / 4GB / 디스크 미포함", life: 36 },
  { k: "ironwolf", name: "IronWolf Pro 12TB NAS HDD", brand: "Seagate", part: "ST12000NE0008", cls: "43201803", cat: "P02-Q07-R018", spec: "3.5인치 SATA 7200rpm 256MB", life: 60 },
  { k: "wdred", name: "WD Red Plus 8TB NAS HDD", brand: "Western Digital", part: "WD80EFZZ", cls: "43201803", cat: "P02-Q07-R018", spec: "3.5인치 SATA 5640rpm 128MB", life: 36 },
  { k: "pm9a3", name: "PM9A3 1.92TB NVMe SSD (U.2)", brand: "Samsung", part: "MZQL21T9HCJR", cls: "43201832", cat: "E05-F20-G062", spec: "U.2 NVMe PCIe 4.0 / 데이터센터용", life: 60 },
  { k: "smt1500", name: "Smart-UPS SMT1500IC 1500VA", brand: "APC", part: "SMT1500IC", cls: "39121011", cat: "E03-F11-G035", spec: "1500VA/1000W 라인인터랙티브 타워형", life: 24 },
  { k: "a4000", name: "RTX A4000 16GB 그래픽카드", brand: "NVIDIA", part: "RTX A4000", cls: "43211711", cat: "E05-F21-G067", spec: "16GB GDDR6 / 싱글슬롯 / 140W", life: 36 },
  // ── 넷원시스템: 네트워크·보안
  { k: "c2960x", name: "Catalyst 2960-X 48포트 PoE+ 스위치", brand: "Cisco", part: "WS-C2960X-48FPS-L", cls: "43222609", cat: "E04-F13-G039", spec: "48x GbE PoE+(740W) / 4x SFP / L2", life: 24 },
  { k: "c9200l", name: "Catalyst 9200L 24포트 PoE+ 스위치", brand: "Cisco", part: "C9200L-24P-4G-E", cls: "43222609", cat: "E04-F13-G039", spec: "24x GbE PoE+ / 4x 1G SFP / Network Essentials", life: 36 },
  { k: "usw24", name: "UniFi Switch Pro 24 PoE", brand: "Ubiquiti", part: "USW-Pro-24-PoE", cls: "43222609", cat: "E04-F13-G039", spec: "24x GbE PoE / 2x 10G SFP+ / L3 Lite", life: 24 },
  { k: "u6pro", name: "UniFi U6 Pro 무선 AP", brand: "Ubiquiti", part: "U6-Pro", cls: "43222640", cat: "E04-F14-G043", spec: "Wi-Fi 6 / 4x4 MIMO / PoE 전원", life: 24 },
  { k: "ap22", name: "Instant On AP22 무선 AP", brand: "Aruba", part: "AP22", cls: "43222640", cat: "E04-F14-G043", spec: "Wi-Fi 6 / 2x2 MIMO / PoE 전원", life: 36 },
  { k: "fg60f", name: "FortiGate 60F 방화벽", brand: "Fortinet", part: "FG-60F", cls: "43222612", cat: "E04-F15-G046", spec: "10x GbE RJ45 / 데스크톱형 방화벽", life: 12 },
  { k: "pa220", name: "PA-220 차세대 방화벽", brand: "Palo Alto Networks", part: "PA-220", cls: "43222612", cat: "E04-F15-G046", spec: "8x GbE RJ45 / 데스크톱형 방화벽", life: 12 },
  // ── 피씨마루: PC·모니터·부품
  { k: "t14", name: "ThinkPad T14 Gen 3 노트북", brand: "Lenovo", part: "T14 Gen 3", cls: "43211503", cat: "E01-F02-G005", spec: "Core i5-1235U / 16GB / SSD 512GB / 14인치 FHD", life: 24 },
  { k: "elite840", name: "EliteBook 840 G8 노트북", brand: "HP", part: "840 G8", cls: "43211503", cat: "E01-F02-G007", spec: "Core i5-1135G7 / 16GB / SSD 256GB / 14인치 FHD", life: 12 },
  { k: "lat5430", name: "Latitude 5430 노트북", brand: "Dell", part: "Latitude 5430", cls: "43211503", cat: "E01-F02-G007", spec: "Core i5-1235U / 16GB / SSD 256GB / 14인치 FHD", life: 24 },
  { k: "op7090", name: "OptiPlex 7090 SFF 데스크톱", brand: "Dell", part: "OptiPlex 7090 SFF", cls: "43211507", cat: "E01-F01-G003", spec: "Core i5-10500 / 16GB / SSD 256GB", life: 24 },
  { k: "ed800", name: "EliteDesk 800 G6 미니 PC", brand: "HP", part: "800 G6 DM", cls: "43211507", cat: "E01-F01-G002", spec: "Core i5-10500T / 16GB / SSD 256GB", life: 12 },
  { k: "m720q", name: "ThinkCentre M720q Tiny 미니 PC", brand: "Lenovo", part: "M720q Tiny", cls: "43211507", cat: "E01-F01-G002", spec: "Core i5-8500T / 8GB / SSD 256GB", life: 6 },
  { k: "lg27", name: "27UP850-W 27인치 4K UHD 모니터", brand: "LG전자", part: "27UP850-W", cls: "43211902", cat: "E06-F24-G075", spec: "27인치 IPS 3840x2160 / USB-C 90W", life: 24 },
  { k: "u2723", name: "UltraSharp U2723QE 27인치 4K 모니터", brand: "Dell", part: "U2723QE", cls: "43211902", cat: "E06-F24-G075", spec: "27인치 IPS Black 3840x2160 / USB-C 90W / 허브", life: 36 },
  { k: "p2422", name: "P2422H 24인치 FHD 모니터", brand: "Dell", part: "P2422H", cls: "43211902", cat: "E06-F24-G075", spec: "24인치 IPS 1920x1080 / 높이 조절·피벗", life: 36 },
  { k: "s980", name: "980 PRO 1TB NVMe SSD", brand: "Samsung", part: "MZ-V8P1T0BW", cls: "43201832", cat: "P02-Q06-R014", spec: "M.2 2280 NVMe PCIe 4.0 / 읽기 최대 7,000MB/s", life: 60 },
  { k: "s870", name: "870 EVO 1TB SATA SSD", brand: "Samsung", part: "MZ-77E1T0B/KR", cls: "43201832", cat: "P02-Q06-R014", spec: "2.5인치 SATA III / 읽기 최대 560MB/s", life: 60 },
  { k: "mx500", name: "MX500 1TB SATA SSD", brand: "Crucial", part: "CT1000MX500SSD1", cls: "43201832", cat: "P02-Q06-R014", spec: "2.5인치 SATA III / 읽기 최대 560MB/s", life: 60 },
  { k: "mxm3s", name: "MX Master 3S 무선 마우스", brand: "Logitech", part: "910-006556", cls: "43211708", cat: "P04-Q16-R048", spec: "블루투스·Logi Bolt / 8000DPI / 저소음 클릭", life: 24 },
];
M.forEach((m, i) => {
  m.prodId = `KP-2026-${String(101 + i).padStart(6, "0")}`; // 개발용 샘플 50건(000001~050)과 겹치지 않게 101 부터
  [m.major, m.middle, m.minor] = m.cat.split("-");
});
const MB = Object.fromEntries(M.map((m) => [m.k, m]));

// 제조사 사이트에서 받은 실제 사진·데이터시트의 업로드 키 (fetch-product-files.mjs 가 만든 assets/manifest.json). 없으면 비워 둔다.
// 마스터에 사진이 있으면 그 매물은 같은 파일을 대표 사진으로 쓴다 (상품 처음 등록 때 마스터가 첫 매물 사진 키를 공유하는 것과 같다)
let FILES = {};
try {
  FILES = JSON.parse(readFileSync(join(here, "assets", "manifest.json"), "utf8"));
} catch {
  // 파일을 아직 안 받았으면 사진·데이터시트 없이 만든다
}
for (const m of M) {
  m.photo = FILES[m.k]?.photo ?? null;
  m.sheet = FILES[m.k]?.datasheet ?? null;
  if ((m.photo ?? "").length > 100 || (m.sheet ?? "").length > 100) throw new Error(`파일 키 100자 초과: ${m.k}`);
}

// ───────────────────────── 매물 (판매자별, 가상 가격) ─────────────────────────
// [판매자, 상품, 상태, 단가, 수량, 최소주문, 주문단위, 설명, 보증일(0|30|90|180|360|720|1080), 불량지원, 대체품]
const L = (seller, k, state, price, qty, min, unit, desc, wdays, cov, repl) => ({ seller, k, state, price, qty, min, unit, desc, wdays, cov, repl });
const N = "신품";
const S90 = "신품대비 90~99%";
const S80 = "신품대비 80~89%";
const S70 = "신품대비 70~79%";
const S60 = "신품대비 60~69%";
const hanbit = [
  L("hanbit", "r650", S90, 5800000, 4, 1, 1, "2024년 구축 후 반납 장비. 레일·전원케이블 포함, RAID·전원 점검 완료.", 360, "대체", "동급 이상 서버로 교환"),
  L("hanbit", "dl380", S80, 3200000, 6, 1, 1, "iLO 라이선스 포함. 전원·팬·디스크 점검 완료, 레일 포함.", 180, "대체", "동급 이상 서버로 교환"),
  L("hanbit", "sr650", S70, 2100000, 3, 1, 1, "XClarity 컨트롤러 초기화 완료. 외관 사용감 있음.", 90, "환불", null),
  L("hanbit", "r750", N, 8900000, 2, 1, 1, "미개봉 신품. 제조사 보증 승계 가능.", 720, "대체", "동일 모델로 교환"),
  L("hanbit", "t350", S90, 1450000, 5, 1, 1, "사무실용 타워 서버. 사용 6개월, 설치 이력 초기화.", 360, "대체", "동급 이상 서버로 교환"),
  L("hanbit", "rdimm", N, 185000, 64, 4, 4, "서버 증설용 신품. 4개 단위 판매.", 720, "대체", "동일 모듈로 교환"),
  L("hanbit", "ds1621", S90, 880000, 3, 1, 1, "본체만 판매(디스크 미포함). 사용 1년, DSM 초기화 완료.", 180, "환불", null),
  L("hanbit", "ironwolf", N, 365000, 20, 2, 1, "NAS·서버용 신품 HDD. 2개 이상 주문.", 360, "대체", "동일 모델로 교환"),
  L("hanbit", "wdred", N, 235000, 12, 1, 1, "NAS용 신품 HDD.", 360, "대체", "동일 모델로 교환"),
  L("hanbit", "pm9a3", N, 330000, 10, 2, 1, "서버 증설용 U.2 NVMe 신품. 2개 이상 주문.", 360, "대체", "동일 모델로 교환"),
  L("hanbit", "smt1500", S80, 420000, 6, 1, 1, "배터리 교체 후 출고. 부하 시험 완료.", 90, "환불", null),
  L("hanbit", "a4000", S80, 780000, 4, 1, 1, "워크스테이션 반납 분. 벤치마크 점검 완료.", 90, "환불", null),
];
const netone = [
  L("netone", "c2960x", S80, 1350000, 8, 1, 1, "초기화 완료, IOS 최신 안정판. 랙 브래킷 포함.", 180, "대체", "동급 PoE 스위치로 교환"),
  L("netone", "c9200l", S90, 1980000, 5, 1, 1, "사용 1년 미만. Network Essentials 라이선스 포함.", 360, "대체", "동급 PoE 스위치로 교환"),
  L("netone", "usw24", N, 890000, 10, 1, 1, "미개봉 신품. UniFi 컨트롤러 즉시 연결 가능.", 720, "대체", "동일 모델로 교환"),
  L("netone", "u6pro", N, 235000, 24, 2, 1, "미개봉 신품. 2개 이상 주문.", 720, "대체", "동일 모델로 교환"),
  L("netone", "ap22", S90, 120000, 18, 2, 1, "사무실 철거 장비. 설치 브래킷 포함.", 360, "대체", "동일 모델로 교환"),
  L("netone", "fg60f", S90, 640000, 6, 1, 1, "라이선스 만료(재등록 필요), 설정 초기화 완료.", 360, "대체", "동급 방화벽으로 교환"),
  L("netone", "pa220", S70, 480000, 3, 1, 1, "랩 장비 반납분. 외관 사용감 있음.", 90, "환불", null),
];
const pcmaru = [
  L("pcmaru", "t14", S80, 620000, 12, 1, 1, "대기업 리스 반납 장비. 배터리 상태 양호, 어댑터 포함.", 180, "대체", "동급 노트북으로 교환"),
  L("pcmaru", "elite840", S70, 480000, 8, 1, 1, "외관 사용감 있음. 어댑터 포함, 윈도우 초기화.", 90, "환불", null),
  L("pcmaru", "lat5430", S80, 590000, 10, 1, 1, "리스 반납 장비. 배터리·키보드 점검 완료.", 180, "대체", "동급 노트북으로 교환"),
  L("pcmaru", "op7090", S80, 340000, 15, 5, 1, "사무실 PC 교체 물량. 5대 이상 주문, 윈도우 초기화.", 180, "대체", "동급 PC로 교환"),
  L("pcmaru", "ed800", S70, 280000, 20, 5, 1, "초소형 미니 PC. 5대 이상 주문, VESA 브래킷 포함.", 90, "환불", null),
  L("pcmaru", "m720q", S60, 190000, 25, 5, 1, "교육용·키오스크용 물량. 5대 이상 주문.", 90, "환불", null),
  L("pcmaru", "lg27", S90, 330000, 14, 1, 1, "사용 1년. 불량화소 없음, 스탠드·USB-C 케이블 포함.", 180, "대체", "동급 모니터로 교환"),
  L("pcmaru", "u2723", N, 690000, 6, 1, 1, "미개봉 신품.", 720, "대체", "동일 모델로 교환"),
  L("pcmaru", "p2422", S80, 120000, 30, 5, 1, "사무실 철거 물량. 5대 이상 주문, 스탠드 포함.", 180, "대체", "동급 모니터로 교환"),
  L("pcmaru", "s980", N, 139000, 50, 1, 1, "미개봉 신품.", 720, "대체", "동일 모델로 교환"),
  L("pcmaru", "s870", N, 109000, 40, 1, 1, "미개봉 신품.", 720, "대체", "동일 모델로 교환"),
  L("pcmaru", "mx500", N, 99000, 25, 1, 1, "미개봉 신품.", 720, "대체", "동일 모델로 교환"),
  L("pcmaru", "mxm3s", N, 109000, 40, 1, 1, "미개봉 신품.", 360, "대체", "동일 모델로 교환"),
];
const minjun = [
  L("minjun", "s980", S90, 115000, 2, 1, 1, "개봉 후 2개월 사용. 박스·영수증 있음.", 0, null, null),
  L("minjun", "lg27", S90, 285000, 1, 1, 1, "집에서 1년 사용. 박스 있음, 불량화소 없음.", 0, null, null),
  L("minjun", "t14", S80, 560000, 1, 1, 1, "개인 사용. 배터리 사이클 낮음, 어댑터 포함.", 0, null, null),
];
// 판매자를 번갈아 놓아 최신순 목록이 한 판매자로 몰리지 않게 한다. 개인 판매자는 사이사이에.
const LISTINGS = [];
for (let i = 0; i < 14; i++) for (const arr of [hanbit, netone, pcmaru]) if (arr[i]) LISTINGS.push(arr[i]);
LISTINGS.splice(5, 0, minjun[0]);
LISTINGS.splice(17, 0, minjun[1]);
LISTINGS.splice(29, 0, minjun[2]);
const LISTING_START = dayStart - 13 * DAY + 9 * HOUR; // 가장 오래된 매물 = 시연일 13일 전 09시
LISTINGS.forEach((l, i) => {
  const reg = LISTING_START + i * 8 * HOUR + ((i * 37) % 60) * 1000; // 초는 다르게 (같은 사용자 같은 초 충돌 방지)
  l.id = `${l.seller}:${l.k}`;
  l.regMs = reg;
  l.regDate = ts14(reg);
  l.provDate = date8(dayStart + (3 + ((i * 5) % 20)) * DAY); // 시연일 +3 ~ +22일
  l.stock = l.qty; // 아래 거래 반영 뒤 줄어든다
  l.dtUpdate = null;
  l.dtExpire = null;
});
const LB = Object.fromEntries(LISTINGS.map((l) => [l.id, l]));

// ───────────────────────── 거래 ─────────────────────────
// 재고 규칙 (TradeService·CartService): 견적요청·견적거절은 재고를 안 건드리고, 견적수락·구매요청·구매확정은 수량만큼 재고에서 빠진다.
// 구매확정으로 재고가 0 이 되면 매물이 판매완료(dt_expire).
const T = (id, buyer, listing, qty, stats, extra = {}) => ({ id, buyer, listing, qty, stats, ...extra });
const TRADES = [
  // 거래완료(구매확정) → 거래이력에 1줄씩. 판매자·구매자 화면의 "내 거래이력" 이 비어 보이지 않게.
  T("H1", "daon", "hanbit:r650", 2, "구매확정", { after: 6, confirmAfter: 5, remarks: "서버실 이전 일정에 맞춰 납품 부탁드립니다." }),
  T("H2", "daon", "netone:c9200l", 3, "구매확정", { after: 5, confirmAfter: 4, remarks: "세금계산서 발행 요청" }),
  T("H3", "seoyeon", "pcmaru:s980", 1, "구매확정", { after: 8, confirmAfter: 6 }),
  T("H4", "jiwoo", "minjun:lg27", 1, "구매확정", { after: 7, confirmAfter: 8, remarks: "직거래 희망합니다." }), // 마지막 1개 → 판매완료
  T("H5", "daon", "pcmaru:p2422", 10, "구매확정", { after: 6, confirmAfter: 6, remarks: "신규 사무실 책상 배치용" }),
  T("H6", "seoyeon", "hanbit:ironwolf", 2, "구매확정", { after: 9, confirmAfter: 5 }),
  T("H7", "daon", "netone:u6pro", 4, "구매확정", { after: 5, confirmAfter: 5 }),
  T("H8", "jiwoo", "pcmaru:mxm3s", 2, "구매확정", { after: 10, confirmAfter: 4 }),
  // 진행 중 — 시연에서 판매자·구매자가 직접 누르는 용도
  T("Q1", "daon", "netone:fg60f", 2, "견적요청", { after: 12, price: 600000, remarks: "지점 2곳 설치 예정, 단가 조정 부탁드립니다." }), // 판매자가 수락/거절
  T("Q2", "jiwoo", "hanbit:dl380", 1, "견적요청", { after: 14, price: 2900000 }), // 판매자가 수락
  T("Q3", "seoyeon", "pcmaru:t14", 2, "견적요청", { after: 16, price: 560000 }), // 같은 매물에 두 건 → 한꺼번에 수락
  T("Q3b", "daon", "pcmaru:t14", 5, "견적요청", { after: 18, price: 580000, remarks: "신입사원 입사 물량" }),
  T("Q4", "daon", "hanbit:t350", 3, "견적요청", { after: 15, price: 1350000 }), // 두 건 합계 6 > 재고 5 → [모두 수락] 에서 묶음 실패
  T("Q5", "jiwoo", "hanbit:t350", 3, "견적요청", { after: 17, price: 1400000 }),
  T("A1", "daon", "hanbit:r750", 1, "견적수락", { after: 9, price: 8400000, remarks: "서버실 신규 구축" }), // 구매자가 [구매] 를 누르는 용도 (재고 1 묶임)
  T("R1", "seoyeon", "pcmaru:lat5430", 2, "견적거절", { after: 11, price: 400000 }), // 구매자가 [재요청]
  T("P1", "seoyeon", "pcmaru:s870", 2, "구매요청", { after: 19 }), // 구매자가 [거래완료]
  T("P2", "daon", "hanbit:rdimm", 8, "구매요청", { after: 20, remarks: "R650 증설용" }), // 4개 단위 주문 (최소·단위 4)
];
const HOLDS = new Set(["견적수락", "구매요청", "구매확정"]);
for (const t of TRADES) {
  const l = LB[t.listing];
  if (!l) throw new Error(`매물 없음: ${t.listing}`);
  t.reqMs = l.regMs + t.after * HOUR + ((t.after * 13) % 50) * MIN; // 매물 등록 뒤에 요청
  t.confirmMs = t.stats === "구매확정" ? t.reqMs + t.confirmAfter * HOUR + 23 * MIN : null;
  t.unit = t.stats.startsWith("견적") ? t.price : l.price;
}
// 요청 시각 순으로 재고를 줄이고 거래ID(yyMMddHH + 시간대별 순번 3자리)를 매긴다
const seqByHour = new Map();
for (const t of [...TRADES].sort((a, b) => a.reqMs - b.reqMs)) {
  const l = LB[t.listing];
  t.stockAtRequest = l.stock;
  if (HOLDS.has(t.stats)) {
    if (t.qty > l.stock) throw new Error(`${t.id}: 재고 부족 (${t.qty} > ${l.stock})`);
    l.stock -= t.qty;
  }
  if (t.qty < l.min || t.qty % l.unit !== 0) throw new Error(`${t.id}: 최소주문/주문단위 위반`);
  const p = parts(t.reqMs);
  const hourKey = `${String(p.y).slice(2)}${p.M}${p.d}${p.h}`;
  const n = (seqByHour.get(hourKey) ?? 0) + 1;
  seqByHour.set(hourKey, n);
  t.tradeId = `${hourKey}${String(n).padStart(3, "0")}`;
  if (t.stats === "구매확정" && l.stock === 0) {
    l.dtUpdate = ts14(t.confirmMs);
    l.dtExpire = ts14(t.confirmMs); // 마지막 재고 구매확정 = 판매완료
  }
}

// ───────────────────────── 길이·범위 검사 (DB 컬럼 길이) ─────────────────────────
const need = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
for (const m of M) {
  need(m.name.length <= 50, `상품명 50자 초과: ${m.name}`);
  need(m.brand.length <= 40, `제조사 40자 초과: ${m.brand}`);
  need(m.part.length <= 20, `파트넘버 20자 초과: ${m.part}`);
  need(m.cls.length <= 20, "물품분류번호");
  need(m.spec.length <= 100, `사양 100자 초과: ${m.k}`);
  need(m.life % 3 === 0 && m.life >= 3 && m.life <= 60, `보증년수(개월) 목록 3~60 의 3 배수: ${m.k}`);
}
for (const l of LISTINGS) {
  need(l.desc.length <= 200, `설명 200자 초과: ${l.id}`);
  need(!l.repl || l.repl.length <= 100, `대체품 100자 초과: ${l.id}`);
  need([0, 30, 90, 180, 360, 720, 1080].includes(l.wdays), `보증기한 허용값 아님: ${l.id}`);
  need(l.min <= l.qty && l.min >= 1 && l.unit >= 1, `최소주문량: ${l.id}`);
  need(l.price >= 0 && l.price <= 1_000_000_000, `단가 범위: ${l.id}`);
}
for (const t of TRADES) need(!t.remarks || t.remarks.length <= 100, `요청사항 100자 초과: ${t.id}`);
need(new Set(LISTINGS.map((l) => `${l.seller}|${l.regDate}`)).size === LISTINGS.length, "같은 판매자·같은 등록시각 매물이 있음");
need(new Set(TRADES.map((t) => t.tradeId)).size === TRADES.length, "거래ID 중복");
need(new Set(USERS.map((u) => u.uid)).size === USERS.length, "uid 중복");

// ───────────────────────── 시트 정의 (헤더 = 정의서 논리명 그대로. DevTableAliases 와 같다) ─────────────────────────
// 칸: [정의서 논리명, 값 만드는 함수, 숫자 칸 여부]
const str = (v) => (v === null || v === undefined || v === "" ? null : String(v));
const num = (v) => (v === null || v === undefined ? null : Number(v));
const SHEETS = [
  {
    file: "01_trd_user_info.xlsx",
    sheet: "사용자 정보",
    rows: USERS,
    cols: [
      ["사용자식별자", (u) => u.uid],
      ["시용자ID", (u) => str(u.loginId)],
      ["비밀번호", () => DEMO_PASSWORD],
      ["사용자 구분", (u) => u.cls],
      ["사용자 명", (u) => u.name],
      ["휴대폰 번호", (u) => u.phone],
      ["이메일", (u) => u.email],
      ["주소", (u) => u.address],
      ["연락수단", () => "1"],
      ["별칭", (u) => str(u.nickname)],
      ["별칭사용여부", (u) => (u.nickname ? "Y" : "N")],
      ["사업자등록번호", (u) => str(u.bus)],
      ["기업구분", (u) => (u.cls === "business" ? "corporate" : null)],
      ["회사명", (u) => str(u.company)],
      ["개업년원일", (u) => str(u.open)],
      ["회사전화번호", (u) => str(u.tel)],
      ["회사주소", (u) => str(u.companyAddress)],
      ["등록 일시", (u) => u.dtReg],
      ["최종갱신일시", (u) => u.dtReg],
    ],
  },
  {
    file: "02_trd_prod_master.xlsx",
    sheet: "상품 마스터",
    rows: M,
    cols: [
      ["상품고유ID", (m) => m.prodId],
      ["상품명", (m) => m.name],
      ["파트넘버", (m) => m.part],
      ["제조사", (m) => m.brand],
      ["물품분류번호", (m) => m.cls],
      ["대분류", (m) => m.major],
      ["중분류", (m) => m.middle],
      ["소분류", (m) => m.minor],
      ["사양정보", (m) => m.spec],
      ["보증년수", (m) => m.life, true],
      ["정품보증방법", () => "제조사 보증"],
      ["DATA SHEET", (m) => str(m.sheet)],
      ["상품이미지", (m) => str(m.photo)],
      ["등록일시", () => ts14(dayStart - 20 * DAY + 10 * HOUR)],
    ],
  },
  {
    file: "03_trd_prod_reg.xlsx",
    sheet: "상품등록 정보",
    rows: LISTINGS,
    cols: [
      ["사용자ID", (l) => U[l.seller].uid],
      ["등록일시", (l) => l.regDate],
      ["상품고유ID", (l) => MB[l.k].prodId],
      ["거래종류", () => "등록"],
      ["상품상태", (l) => l.state],
      ["등록단가", (l) => l.price, true],
      ["등록수량", (l) => l.qty, true],
      ["최소주문량", (l) => l.min, true],
      ["주문단위", (l) => l.unit, true],
      ["제공가능일", (l) => l.provDate],
      ["재고수량", (l) => l.stock, true],
      ["상품설명", (l) => l.desc],
      ["DATA SHEET", (l) => (l.seller === "minjun" ? null : str(MB[l.k].sheet))], // 개인 판매자는 서류 없이
      ["상품사진1", (l) => str(MB[l.k].photo)],
      ["보증기한", (l) => l.wdays, true],
      ["불량지원방법", (l) => str(l.cov)],
      ["대체품", (l) => str(l.repl)],
      ["최종갱신일시", (l) => str(l.dtUpdate)],
      ["거래완료일시", (l) => str(l.dtExpire)],
    ],
  },
  {
    file: "04_trd_trade_info.xlsx",
    sheet: "거래 정보",
    rows: [...TRADES].sort((a, b) => a.reqMs - b.reqMs),
    cols: [
      ["사용자ID", (t) => U[t.buyer].uid],
      ["거래ID", (t) => t.tradeId],
      ["거래종류", (t) => (t.stats.startsWith("견적") ? "견적조정" : "거래")],
      ["판매자ID", (t) => U[LB[t.listing].seller].uid],
      ["상품등록일시", (t) => LB[t.listing].regDate],
      ["상품고유ID", (t) => MB[LB[t.listing].k].prodId],
      ["상품상태", (t) => LB[t.listing].state],
      ["등록단가", (t) => LB[t.listing].price, true],
      ["재고수량", (t) => t.stockAtRequest, true],
      ["최소주문량", (t) => LB[t.listing].min, true],
      ["주문단위", (t) => LB[t.listing].unit, true],
      ["제공가능일", (t) => LB[t.listing].provDate],
      ["주문단가", (t) => t.unit, true],
      ["주문량", (t) => t.qty, true],
      ["납품희망일", (t) => LB[t.listing].provDate],
      ["요청사항", (t) => str(t.remarks)],
      ["거래상태", (t) => t.stats],
      ["등록일시", (t) => ts14(t.reqMs)],
    ],
  },
  {
    file: "05_trd_trade_history.xlsx",
    sheet: "거래이력 정보",
    rows: TRADES.filter((t) => t.stats === "구매확정").sort((a, b) => a.confirmMs - b.confirmMs),
    cols: [
      ["사용자ID", (t) => U[t.buyer].uid],
      ["거래ID", (t) => t.tradeId],
      ["확정일시", (t) => ts14(t.confirmMs)],
      ["상품ID", (t) => MB[LB[t.listing].k].prodId],
      ["거래종류", () => "거래"],
      ["판매자ID", (t) => U[LB[t.listing].seller].uid],
      ["거래단가", (t) => t.unit, true],
      ["거래량", (t) => t.qty, true],
      ["거래금액", (t) => t.unit * t.qty, true],
    ],
  },
];

// ───────────────────────── xlsx 쓰기 (최소 구현: stored zip + 머리글 굵게·열 너비·첫 줄 고정) ─────────────────────────
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function colName(i) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
const width = (s) => [...String(s)].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0);

function sheetXml(header, body) {
  const widths = header.map((h, c) => Math.min(60, Math.max(width(h) + 4, ...body.map((r) => (r[c] === null ? 0 : width(r[c].v) + 2)), 10)));
  const cols = `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`;
  const headRow = `<row r="1">${header.map((h, c) => `<c r="${colName(c)}1" s="1" t="inlineStr"><is><t>${esc(h)}</t></is></c>`).join("")}</row>`;
  const rows = body
    .map(
      (row, r) =>
        `<row r="${r + 2}">` +
        row
          .map((cell, c) =>
            cell === null
              ? ""
              : cell.n
                ? `<c r="${colName(c)}${r + 2}"><v>${cell.v}</v></c>`
                : `<c r="${colName(c)}${r + 2}" t="inlineStr"><is><t>${esc(String(cell.v))}</t></is></c>`,
          )
          .join("") +
        "</row>",
    )
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `${cols}<sheetData>${headRow}${rows}</sheetData></worksheet>`
  );
}

function zip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of files) {
    const nameBuf = Buffer.from(name, "utf8");
    const data = Buffer.from(text, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBuf.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBuf, end]);
}

const XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`;
const STYLES = `${XML}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDDE7F3"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`;
function xlsx(sheets) {
  const n = sheets.length;
  const sheetOverrides = sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const sheetEntries = sheets.map((sh, i) => `<sheet name="${esc(sh.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("");
  const sheetRels = sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("");
  return zip([
    ["[Content_Types].xml", `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetOverrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ["_rels/.rels", `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `${XML}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries}</sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", STYLES],
    ...sheets.map((sh, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sh.header, sh.body)]),
  ]);
}

// ───────────────────────── 쓰기 ─────────────────────────
mkdirSync(OUT, { recursive: true });
const counts = [];
const built = SHEETS.map((s) => {
  const header = s.cols.map(([h]) => h);
  const body = s.rows.map((row) =>
    s.cols.map(([, f, isNum]) => {
      const v = f(row);
      return v === null || v === undefined ? null : { v: isNum ? num(v) : v, n: !!isNum };
    }),
  );
  return { file: s.file, name: s.sheet, header, body };
});
for (const b of built) {
  writeFileSync(join(OUT, b.file), xlsx([b]));
  counts.push(`${b.file}  ${String(b.body.length).padStart(3)}행  (${b.name})`);
}
// 한 파일에 시트 5개 — [엑셀 전체 불러오기] 용. 서버가 부모 → 자식 순서로 넣는다(시트 순서와 무관하지만 의존 순서대로 둔다)
writeFileSync(join(OUT, '00_전체.xlsx'), xlsx(built));
counts.unshift(`00_전체.xlsx  시트 ${built.length}개 (${built.map((b) => b.name).join(" / ")})`);

// ───────────────────────── 데이터 목록 (시연 안내서가 가리킨다) ─────────────────────────
const won = (n) => n.toLocaleString("en-US");
const fmtDay = (ms) => {
  const p = parts(ms);
  return `${p.M}-${p.d} ${p.h}:${p.m}`;
};
const md = [];
md.push(`# 시연 데이터 목록`);
md.push(``);
md.push(`> \`build-demo-data.mjs\` 가 만든 결과 요약 (자동 생성 — 직접 고치지 않는다). 시연일 ${DEMO_DAY}, uid 기준일 ${UID_DAY}, 첫 일련번호 ${UID_START}.`);
md.push(`> 사람·회사·사업자번호·전화·이메일은 전부 가상이다. 제조사·모델명만 실제 제품 이름.`);
md.push(``);
md.push(`## 계정 (비밀번호 전부 \`${DEMO_PASSWORD}\`)`);
md.push(``);
md.push(`| uid | 아이디 | 구분 | 화면에 보이는 이름 | 시연 역할 |`);
md.push(`|---|---|---|---|---|`);
for (const u of USERS) md.push(`| ${u.uid} | ${u.loginId} | ${u.cls === "business" ? "기업" : "개인"} | ${u.cls === "business" ? u.company : u.nickname ?? u.loginId} | ${u.role} |`);
md.push(``);
md.push(`## 매물 ${LISTINGS.length}건 (최신 등록 순)`);
md.push(``);
md.push(`| 판매자 | 상품 | 제조사 | 소분류 | 상태 | 단가 | 등록수량 | 재고 | 최소/단위 | 등록 |`);
md.push(`|---|---|---|---|---|---|---|---|---|---|`);
for (const l of [...LISTINGS].reverse()) {
  const m = MB[l.k];
  md.push(`| ${U[l.seller].loginId} | ${m.name} | ${m.brand} | ${m.cat} | ${l.state} | ${won(l.price)} | ${l.qty} | ${l.stock}${l.dtExpire ? " (판매완료)" : ""} | ${l.min}/${l.unit} | ${fmtDay(l.regMs)} |`);
}
md.push(``);
md.push(`## 거래 ${TRADES.length}건 (요청 순)`);
md.push(``);
md.push(`| 거래ID | 구매자 → 판매자 | 상품 | 수량 | 단가 | 상태 | 시연 용도 |`);
md.push(`|---|---|---|---|---|---|---|`);
const USE = {
  H1: "거래이력", H2: "거래이력", H3: "거래이력", H4: "거래이력 + 이 매물 판매완료 표시", H5: "거래이력", H6: "거래이력", H7: "거래이력", H8: "거래이력",
  Q1: "판매자 netone01 이 [수락]/[거절]", Q2: "판매자 hanbit01 이 [수락]", Q3: "같은 매물 견적 2건 → [모든 견적요청 보기] 한꺼번에 수락", Q3b: "(Q3 과 한 묶음)",
  Q4: "합계(6)가 재고(5) 초과 → [모두 수락] 에서 묶음 실패, 건별 수락", Q5: "(Q4 와 한 묶음)",
  A1: "구매자 daon01 이 [구매] (수락된 견적, 수량 1 묶임)", R1: "구매자 seoyeon01 이 [재요청]", P1: "구매자 seoyeon01 이 [거래완료]", P2: "판매자 hanbit01 이 받은 구매요청 확인 / 취소",
};
for (const t of [...TRADES].sort((a, b) => a.reqMs - b.reqMs)) {
  const l = LB[t.listing];
  md.push(`| ${t.tradeId} | ${U[t.buyer].loginId} → ${U[l.seller].loginId} | ${MB[l.k].name} | ${t.qty} | ${won(t.unit)}${t.stats.startsWith("견적") ? " (희망)" : ""} | ${t.stats} | ${USE[t.id]} |`);
}
md.push(``);
writeFileSync(join(OUT, "데이터-목록.md"), md.join("\n"));

console.log(`시연일 ${DEMO_DAY} / uid ${uidPrefix}${String(UID_START).padStart(3, "0")} ~ ${uidPrefix}${String(UID_START + USERS.length - 1).padStart(3, "0")}`);
console.log(counts.join("\n"));
console.log(`→ ${OUT}`);
