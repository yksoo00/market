# 기업 가입 담당자 본인인증(임시) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기업 가입에도 일반 가입과 똑같은 휴대폰 본인인증(임시) 단계를 넣는다.

## 설계

- 요청: 담당자 휴대폰 인증을 일반 회원과 똑같이. 지금은 버튼을 누르면 바로 성공.
- 위치: 폼 맨 위 "본인인증" 줄. 일반 가입과 같은 `IdentityVerifyButton`, 같은 문구(`signup.verify.*`), 같은 완료 띠.
- 막는 범위: 인증 전에는 아래 입력 전체(담당자·계정·회사 정보·약관)를 막고 60% 흐리게 한다. 가입 버튼은 비활성, 안내 문구는 `signup.form.needVerify`.
- 서버: 바꾸지 않는다. 일반 가입과 같이 인증 결과를 보내지도 저장하지도 않는다. API·DB 변경 없음.
- 인증 뒤 휴대폰 번호를 고쳐도 인증은 유지한다 (일반 가입과 같은 동작. 임시 인증은 번호를 받지 않는다).
- 아이디·비밀번호 찾기(기업)는 바꾸지 않는다.
- 2026-09-21 "기업 가입에 담당자 본인인증 없음"의 이유는 계정이 담당자 개인에 묶이는 것이었다. 지금은 CI 를 저장하지 않아 묶이지 않는다. 실제 업체를 연동할 때 다시 정한다.

**Architecture:** `BusinessSignupForm` 에 `verified` 상태를 두고 `PersonalSignupForm` 의 본인인증 블록을 그대로 따른다. 사용하는 곳이 두 곳이라 공용 컴포넌트로 빼지 않는다.

**Tech Stack:** Next.js, react-hook-form, Playwright

**Spec:** 이 파일의 "설계" 절

## Global Constraints

- 브랜치 `feat/business-contact-verify`, PR 대상 `dev`.
- 사용자에게 보이는 문구는 `frontend/src/messages/` 에만 둔다.
- 의존성 추가 없음.

## Review Focus

- 인증 전: 입력, [조회], [중복확인], 약관 체크박스, 기업 구분 선택이 전부 눌리지 않아야 한다 (Task 1 E2E 는 담당자명 칸과 약관 체크박스로 확인).
- 좁은 칸(390px, 3분할 보조 칸): 본인인증 줄이 일반 가입처럼 줄바꿈되어야 한다.
- 가입 실패 후 다시 시도: 인증 상태가 유지되어야 한다.

---

### Task 1: 기업 가입 폼 본인인증 단계

**Files:**
- Modify: `frontend/src/components/signup/BusinessSignupForm.tsx`
- Modify: `frontend/src/messages/signup.ts` (`business.form.subtitle`)
- Test: `frontend/e2e/business-signup.spec.ts`

**Interfaces:**
- Consumes: `IdentityVerifyButton({ onVerified })`, `signup.verify.{label,note,done}`, `signup.form.needVerify`, `auth` 의 본인인증 버튼 문구(`IdentityVerifyButton` 기본 label)

- [ ] **Step 1: E2E 에 실패하는 확인 추가**

`"담당자·계정·회사 정보·약관을 넣고 가입"` 단계 앞에 새 단계를 넣는다.

```ts
await test.step("본인인증 전에는 입력이 막히고, 누르면 바로 인증된다", async () => {
  await expect(f.locator('input[name="contactName"]')).toBeDisabled();
  await expect(f.getByRole("checkbox", { name: signup.terms.all })).toBeDisabled();
  await expect(f.getByText(signup.form.needVerify)).toBeVisible();
  await f.getByRole("button", { name: auth.verify.button }).click();
  await expect(f.getByText(signup.verify.done)).toBeVisible();
  await expect(f.locator('input[name="contactName"]')).toBeEnabled();
});
```

- [ ] **Step 2: 실패 확인** (백엔드·compose 실행 필요)

Run: `pnpm e2e business-signup.spec.ts`
Expected: FAIL, `contactName` 이 enabled

- [ ] **Step 3: 폼 구현**

- `const [verified, setVerified] = useState(false);` 에 일반 폼과 같은 `TODO(본인인증 업체 계약 전)` 주석.
- `<form>` 첫 자식: `PersonalSignupForm.tsx:114-122` 와 같은 `FieldShell` 블록.
- 담당자·계정·회사 `Section` 3개, `TermsAgreement`, `reviewNotice` 를 `<fieldset disabled={!verified} className="flex min-w-0 flex-col gap-4 disabled:opacity-60">` 로 감싼다.
- 담당자 `Section` 의 `first` 를 없애 본인인증 줄과 구분선이 생기게 한다. `first` prop 이 미사용이 되면 지운다.
- `canSubmit = verified && isValid && Boolean(token) && loginIdChecked`
- `hint`: `!verified ? t.form.needVerify :` 를 맨 앞에 둔다.
- `business.form.subtitle`: `"본인인증 후 담당자 정보와 계정을 정하고, 사업자등록번호를 조회해 회사 정보를 입력하세요."`
- 파일 맨 위 순서 주석에 "본인인증 →" 추가.

- [ ] **Step 4: 확인**

Run: `pnpm typecheck && pnpm lint && pnpm e2e business-signup.spec.ts`
Expected: PASS

화면 확인: 390px, 데스크톱 `[홈 | 가입]`.

- [ ] **Step 5: Commit** `feat(frontend): 기업 가입에 담당자 본인인증(임시) 단계`

### Task 2: 문서

**Files:**
- Modify: `docs/decisions.md` (색인의 "계정"·"기업" 줄 갱신 + 맨 아래 새 항목 `2026-11-26 기업 가입도 본인인증(임시)`: 결정·이유·감수(서버 미확인)·재검토 조건(업체 계약))
- Modify: `docs/security.md:40` (일반·기업 가입 모두 임시 본인인증)
- Modify: `docs/design.md:159` 근처 (기업 가입도 맨 위 본인인증, 일반과 같은 규격)

- [ ] **Step 1: 세 문서 수정.** 기존 결정 항목은 지우지 않는다.
- [ ] **Step 2: Commit** `docs: 기업 가입 본인인증(임시) 결정 기록`
