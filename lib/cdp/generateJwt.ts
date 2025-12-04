import { generateJwt } from "@coinbase/cdp-sdk/auth";

export async function getCdpBearerForValidateToken() {
  const apiKeyId = process.env.CDP_API_KEY_ID!;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET!;

  if (!apiKeyId || !apiKeySecret) {
    throw new Error(
      "CDP_API_KEY_ID / CDP_API_KEY_SECRET env가 설정되어 있지 않습니다."
    );
  }

  const jwt = await generateJwt({
    apiKeyId,
    apiKeySecret, // Portal에서 받은 Secret API Key (base64/PEM)
    requestMethod: "POST",
    requestHost: "api.cdp.coinbase.com",
    requestPath: "/platform/v2/end-users/auth/validate-token",
    expiresIn: 120,
  });

  return jwt;
}
