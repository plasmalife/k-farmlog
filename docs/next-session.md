# 다음 작업 (2026-10-01)

- GitHub plasmalife/k-farmlog, Vercel hamburus-projects/k-farmlog, 운영 https://k-farmlog.vercel.app
- 사용자 reference 폴더의 수정 요구서와 PPTX 3개 반영. 메인 중앙 친구소식, 사진 최대3장/삭제/재촬영, OCR 상세 비료정보/첫 사진 상태분석, 음성 STT→수정→요약, 오늘의 일기 UI.
- Supabase cjalujpyghyvyuiqpgdk (서울) 생성 및 초기/권한/공개 게시판 사진 마이그레이션 적용 완료. 보안 advisor 지적 없음. 비회원 공개 게시물 조회 HTTP200.
- Vercel Production Supabase URL/key 확인 완료. OPENAI_API_KEY는 서버 비밀값. OPENAI_KEY_API라는 별도 값도 있으나 앱은 사용하지 않음.
- 실제 OpenAI 합성 사진 OCR 및 합성 음성 인식 성공. 비료 수식/단위/수량 확인.
- Playwright PC/mobile의 사진 저장·삭제·새로고침, STT와 공개 게시물 흐름은 모의 연결 검증. 실제 인증 저장 검증으로 보고하면 안 됨.
- 아직 Supabase Anonymous Sign-Ins 비활성. https://supabase.com/dashboard/project/cjalujpyghyvyuiqpgdk/auth/providers 에서 사용자가 켜야 함. 컴퓨터 유즈(cua와 sky 모두)는 sandbox helper 초기화 오류로 접속 실패.
- 활성화 후 두 사용자 세션으로 실제 회원가입, 개인 기록 CRUD/사진 비공개, 공개 게시판, AI 앱 경로 전체 검증 필요.
- 사진 365일 정리용 CRON_SECRET와 SUPABASE_SERVICE_ROLE_KEY 미설정.
- 비밀 문서/환경변수/원본 참고자료는 Git과 배포에서 제외. public/samples만 사용자 요청한 참고 샘플로 제공.
