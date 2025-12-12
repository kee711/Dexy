// lib/thirdwebClient.ts
import { createThirdwebClient } from "thirdweb";

// 빌드 시 환경 변수가 없을 수 있으므로 안전하게 처리
// Vercel 배포 시에는 반드시 NEXT_PUBLIC_THIRDWEB_CLIENT_ID 환경 변수를 설정해야 함
const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

// thirdweb은 clientId가 필수이므로, 없으면 빌드가 실패함
// 빌드 시에는 유효한 형식의 placeholder를 사용하되,
// 실제 배포 시에는 반드시 환경 변수를 설정해야 함
// thirdweb clientId는 보통 UUID 형식이므로 유효한 형식의 placeholder 사용
export const client = createThirdwebClient({
  clientId: clientId || "00000000-0000-0000-0000-000000000000",
});
