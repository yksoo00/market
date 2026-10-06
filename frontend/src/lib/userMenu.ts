/** 헤더 사용자 아이콘에 넣는 한 글자. 서로게이트 쌍(이모지)이 깨지지 않게 Array.from 으로 자른다 */
export function initialOf(nickname: string): string {
  const first = Array.from(nickname.trim())[0];
  return first ? first.toUpperCase() : "?";
}
