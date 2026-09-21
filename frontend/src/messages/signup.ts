export const signup = {
  title: "회원가입",
  choose: {
    subtitle: "가입 유형을 선택하세요.",
    personal: { title: "일반 회원", desc: "개인으로 장비를 사고팝니다. 휴대폰 본인인증이 필요합니다." },
    business: { title: "기업 회원", desc: "사업자 명의로 거래합니다. 사업자등록번호 인증이 필요합니다." },
    haveAccount: "이미 계정이 있으세요?",
    login: "로그인",
  },

  steps: { verify: "본인인증", terms: "약관 동의", form: "정보 입력", done: "완료" },

  verify: {
    title: "본인인증",
    subtitle: "안전한 거래를 위해 휴대폰 본인인증을 진행합니다. 인증한 이름과 휴대폰 번호로 가입됩니다.",
    note: "본인인증 정보는 계정 확인 용도로만 쓰이며 화면에 노출되지 않습니다.",
  },

  terms: {
    title: "약관 동의",
    subtitle: "서비스 이용을 위해 아래 약관에 동의해 주세요.",
    all: "전체 동의",
    required: "필수",
    optional: "선택",
    view: "보기",
    close: "닫기",
    next: "동의하고 계속",
    draftNotice: "약관 문안은 법무 검토 전 초안입니다.",
  },

  form: {
    title: "정보 입력",
    subtitle: "가입에 필요한 정보를 입력하세요.",
    name: "이름",
    namePlaceholder: "실명",
    nickname: "닉네임",
    nicknameHint: "화면에 표시되는 이름",
    nicknamePlaceholder: "2~20자",
    loginId: "아이디",
    loginIdHint: "가입 후 변경 불가",
    loginIdPlaceholder: "영문 소문자·숫자 5~20자",
    email: "이메일",
    emailLocalPlaceholder: "이메일",
    emailDomainCustom: "직접 입력",
    emailDomainPlaceholder: "도메인 입력",
    password: "비밀번호",
    passwordPlaceholder: "10~32자, 영문·숫자·특수문자 포함",
    passwordConfirm: "비밀번호 확인",
    phone: "휴대폰 번호",
    check: "중복확인",
    checking: "확인 중…",
    available: { loginId: "사용할 수 있는 아이디입니다.", nickname: "사용할 수 있는 닉네임입니다." },
    taken: { loginId: "이미 사용 중인 아이디입니다.", nickname: "이미 사용 중인 닉네임입니다." },
    needCheck: "중복확인을 해주세요.",
    submit: "가입하기",
    errors: {
      DUPLICATE_LOGIN_ID: "이미 사용 중인 아이디입니다.",
      DUPLICATE_NICKNAME: "이미 사용 중인 닉네임입니다.",
      DUPLICATE_EMAIL: "이미 가입된 이메일입니다.",
      DUPLICATE_PHONE: "이미 가입된 휴대폰 번호입니다.",
      VERIFICATION_EXPIRED: "본인인증이 만료되었습니다. 처음부터 다시 진행해 주세요.",
    } as Record<string, string>,
  },

  social: {
    title: "가입 마무리",
    subtitle: { kakao: "카카오 계정으로 처음 로그인했습니다.", naver: "네이버 계정으로 처음 로그인했습니다.", google: "Google 계정으로 처음 로그인했습니다." } as Record<string, string>,
    subtitleFallback: "소셜 계정으로 처음 로그인했습니다.",
    lead: "약관에 동의하고 닉네임을 정하면 가입이 끝납니다.",
    nickname: "닉네임",
    nicknameHint: "프로필 이름을 가져왔어요. 바꿔도 됩니다",
    submit: "가입 완료",
    invalid: "로그인 정보가 만료되었거나 올바르지 않습니다. 다시 로그인해 주세요.",
    toLogin: "로그인으로",
    errors: {
      OAUTH_EXPIRED: "로그인 정보가 만료되었습니다. 다시 로그인해 주세요.",
      DUPLICATE_NICKNAME: "이미 사용 중인 닉네임입니다.",
    } as Record<string, string>,
  },

  done: {
    title: "가입 완료",
    message: "회원가입이 끝났습니다. 로그인하고 거래를 시작하세요.",
    login: "로그인",
    home: "홈으로",
  },

  // 검증 문구. 수치는 docs/security.md "계정"
  validation: {
    name: "이름은 한글 또는 영문 2~30자로 입력하세요.",
    nickname: "닉네임은 2~20자로 입력하세요.",
    emailLocal: "이메일 앞부분을 입력하세요.",
    emailDomain: "이메일 도메인을 입력하세요.",
    phone: "휴대폰 번호 8자리를 입력하세요.",
  },
};

export const emailDomains = ["naver.com", "gmail.com", "daum.net", "kakao.com", "nate.com", "hanmail.net"] as const;
export const phonePrefixes = ["010", "011", "016", "017", "018", "019"] as const;
