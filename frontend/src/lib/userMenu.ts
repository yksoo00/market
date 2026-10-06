// 사업자 닉네임은 상호라 "(주)커널"처럼 법인 표기로 시작하는 일이 많다 — 원에 "(" 가 들어가지 않게 떼어 낸다
const COMPANY_PREFIX = /^\s*(?:\(주\)|\[주\]|㈜)\s*/;
// 원에 넣을 만한 글자: 문자·숫자·이모지(국기 포함). 앞의 ★·#·[ 같은 기호는 건너뛴다
const DRAWABLE = /[\p{L}\p{N}\p{Extended_Pictographic}\p{Regional_Indicator}]/u;
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** 헤더 사용자 아이콘에 넣는 한 글자. 국기·결합 이모지가 쪼개지지 않게 grapheme 단위로 자른다 */
export function initialOf(nickname: string): string {
  for (const { segment } of graphemes.segment(nickname.replace(COMPANY_PREFIX, ""))) {
    if (!DRAWABLE.test(segment)) continue;
    const upper = segment.toUpperCase();
    // ß → SS 처럼 대문자가 두 글자가 되면 원에 두 글자가 들어가므로 그대로 둔다
    return Array.from(upper).length === Array.from(segment).length ? upper : segment;
  }
  return "?";
}
