export const auth = {
  tabs: { personal: "일반 회원", business: "기업 회원" },

  login: {
    title: "로그인",
    subtitle: { personal: "아이디와 비밀번호를 입력하세요", business: "사업자등록번호와 비밀번호를 입력하세요" },
    loginId: "아이디",
    loginIdPlaceholder: "아이디",
    bizNo: "사업자등록번호",
    bizNoPlaceholder: "숫자 10자리 ('-' 없이)",
    password: "비밀번호",
    passwordPlaceholder: "비밀번호",
    showPassword: "비밀번호 보기",
    hidePassword: "비밀번호 숨기기",
    remember: "로그인 상태 유지",
    submit: "로그인",
    findId: "아이디 찾기",
    findPassword: "비밀번호 찾기",
    signup: "회원가입",
    noAccount: "아직 계정이 없으세요?",
    socialDivider: "또는",
    social: { kakao: "카카오로 시작하기", naver: "네이버로 시작하기", google: "Google로 시작하기" },
    businessHint: "기업 회원 가입은 사업자등록번호 인증이 필요합니다.",
    // 서버 코드 → 문구. 없는 코드는 서버 message 그대로
    errors: {
      INVALID_CREDENTIALS: "아이디 또는 비밀번호가 맞지 않습니다.",
      LOCKED: "로그인을 5회 이상 실패해 15분간 잠겼습니다. 잠시 후 다시 시도하세요.",
      RATE_LIMITED: "시도가 너무 많습니다. 잠시 후 다시 시도하세요.",
    } as Record<string, string>,
  },

  verify: {
    button: "휴대폰 본인인증",
    done: "본인인증 완료",
  },

  findId: {
    title: "아이디 찾기",
    subtitle: "가입할 때 인증한 휴대폰으로 본인인증을 하면 아이디를 알려 드립니다.",
    resultLabel: "회원님의 아이디",
    joinedAt: "가입일",
    notFound: "본인인증 정보로 가입된 계정이 없습니다. 소셜 계정으로 가입했다면 소셜 로그인을 이용해 주세요.",
    toLogin: "로그인으로",
    toFindPassword: "비밀번호 찾기",
    backToLogin: "로그인으로",
    businessNote: "기업 회원은 사업자등록번호로 로그인합니다.",
  },

  findPassword: {
    title: "비밀번호 찾기",
    subtitle: {
      personal: "아이디를 입력하고 본인인증을 하면 새 비밀번호를 설정할 수 있습니다.",
      business: "사업자등록번호와 가입할 때 등록한 담당자 이메일을 입력하면 재설정 링크를 보내 드립니다.",
    },
    loginId: "아이디",
    bizNo: "사업자등록번호",
    businessEmail: "담당자 이메일",
    emailPlaceholder: "example@company.com",
    newPassword: "새 비밀번호",
    newPasswordConfirm: "새 비밀번호 확인",
    submit: "비밀번호 변경",
    submitBusiness: "재설정 링크 보내기",
    done: "비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.",
    doneBusiness:
      "입력한 담당자 이메일로 재설정 링크를 보냈습니다. 링크는 30분간 유효합니다. 메일이 오지 않으면 스팸함과 입력한 정보를 확인해 주세요.",
    businessContact: "담당자가 바뀌어 이메일을 쓸 수 없다면 고객센터로 문의해 주세요.",
    backToLogin: "로그인으로",
    errors: {
      NOT_FOUND: "입력한 정보와 본인인증 결과가 일치하는 계정이 없습니다.",
      VERIFICATION_MISMATCH: "본인인증한 사람과 계정 소유자가 다릅니다.",
    } as Record<string, string>,
  },

  resetPassword: {
    title: "새 비밀번호 설정",
    subtitle: "새로 사용할 비밀번호를 입력하세요.",
    invalid: "링크가 만료되었거나 올바르지 않습니다. 비밀번호 찾기를 다시 진행해 주세요.",
    toFindPassword: "비밀번호 찾기",
    errors: {
      TOKEN_EXPIRED: "링크가 만료되었습니다. 비밀번호 찾기를 다시 진행해 주세요.",
      TOKEN_INVALID: "올바르지 않은 링크입니다. 비밀번호 찾기를 다시 진행해 주세요.",
    } as Record<string, string>,
  },

  // 검증 문구. 규칙 수치는 docs/security.md "입력 검증"
  validation: {
    required: "필수 입력입니다.",
    loginId: "아이디는 영문 소문자로 시작하고, 영문 소문자·숫자 5~20자여야 합니다.",
    password: "비밀번호는 10~32자, 영문·숫자·특수문자를 각각 1개 이상 포함해야 합니다.",
    passwordHasId: "비밀번호에 아이디를 포함할 수 없습니다.",
    passwordConfirm: "비밀번호가 서로 다릅니다.",
    bizNo: "사업자등록번호는 숫자 10자리입니다.",
    email: "올바른 이메일 형식이 아닙니다.",
  },
};
