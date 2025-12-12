# Vercel 배포 가이드

## 해결된 문제

1. ✅ **`dotenv/config` import 제거**: Vercel은 환경 변수를 자동으로 로드하므로 `import "dotenv/config"`가 불필요하고 빌드 오류를 유발할 수 있습니다.

2. ✅ **Next.js 16 async params**: Route handler의 `params`가 Promise로 변경되어 `await params`로 처리하도록 수정했습니다.

3. ✅ **Test 파일 제외**: `serverExternalPackages` 설정으로 test 파일이 번들에 포함되지 않도록 했습니다.

4. ✅ **GlobalHeader 클라이언트 컴포넌트**: `"use client"` 지시어를 추가하여 클라이언트 컴포넌트로 명시했습니다.

5. ⚠️ **thirdweb 클라이언트 ID**: `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` 환경 변수가 **반드시** 설정되어야 합니다. 이 변수가 없으면 빌드가 실패합니다.

## Vercel 환경 변수 설정

Vercel 대시보드에서 다음 환경 변수들을 설정해야 합니다:

### 필수 환경 변수

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
OPENAI_API_KEY=...
FLOCK_API_KEY=...
NEXT_PUBLIC_CDP_PROJECT_ID=...
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=...  # ⚠️ 필수: thirdweb 클라이언트 ID (thirdweb 대시보드에서 발급)
```

### 선택적 환경 변수 (기본값이 있음)

```
AVALANCHE_FUJI_RPC_URL=... (기본값: Avalanche Fuji 공식 RPC)
AVALANCHE_FUJI_USDC_ADDRESS=... (기본값: 0x5425890298aed601595a70AB815c96711a31Bc65)
BASE_SEPOLIA_RPC_URL=...
BASE_SEPOLIA_USDC_ADDRESS=...
```

## 배포 단계

1. **환경 변수 설정**:
   - Vercel 대시보드 → 프로젝트 → Settings → Environment Variables
   - 위의 모든 환경 변수를 추가

2. **빌드 설정 확인**:
   - Build Command: `npm run build` (기본값)
   - Output Directory: `.next` (기본값)
   - Install Command: `npm install` (기본값)

3. **배포**:
   - Git push 후 자동 배포되거나
   - Vercel 대시보드에서 수동으로 배포

## 문제 해결

### 빌드 실패 시

1. **환경 변수 확인**: 모든 필수 환경 변수가 설정되었는지 확인
   - 특히 `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`가 설정되었는지 확인
   - thirdweb 대시보드(https://thirdweb.com)에서 클라이언트 ID를 발급받아 설정
2. **빌드 로그 확인**: Vercel 대시보드의 Build Logs에서 정확한 오류 확인
3. **로컬 빌드 테스트**: `npm run build`로 로컬에서 빌드가 성공하는지 확인
   - 로컬에서는 `.env.local` 파일에 환경 변수를 설정

### 런타임 오류 시

1. **서버 로그 확인**: Vercel 대시보드의 Functions 탭에서 로그 확인
2. **환경 변수 확인**: 런타임에서 환경 변수가 제대로 로드되는지 확인
3. **API Route 확인**: `/api/*` 경로의 함수가 제대로 작동하는지 확인

## 참고사항

- Vercel은 자동으로 환경 변수를 주입하므로 `dotenv` 패키지가 필요 없습니다
- `NEXT_PUBLIC_*` 접두사가 있는 변수는 클라이언트에서도 접근 가능합니다
- 서버 전용 변수는 `NEXT_PUBLIC_` 접두사 없이 설정하세요

