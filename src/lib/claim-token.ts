import { SignJWT, jwtVerify } from "jose";

const issuer = "watch-earn";
const audience = "ad-claim";

function signingKey() {
  const secret = process.env.CLAIM_TOKEN_SECRET ??
    (process.env.NODE_ENV === "development" ? "daymark-local-development-only-claim-token-key" : undefined);
  if (!secret || new TextEncoder().encode(secret).length < 32) {
    throw new Error("CLAIM_TOKEN_SECRET must contain at least 32 bytes.");
  }
  return new TextEncoder().encode(secret);
}

export type ClaimPayload = {
  userId: string;
  campaignId: string;
  startTime: number;
  durationSeconds: number;
  jti: string;
};

export async function createClaimToken(payload: ClaimPayload) {
  return new SignJWT({
    userId: payload.userId,
    campaignId: payload.campaignId,
    startTime: payload.startTime,
    durationSeconds: payload.durationSeconds,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(payload.userId)
    .setJti(payload.jti)
    .setIssuedAt(Math.floor(payload.startTime / 1000))
    .setExpirationTime(Math.floor(payload.startTime / 1000) + payload.durationSeconds + 300)
    .sign(signingKey());
}

export async function verifyClaimToken(token: string) {
  const { payload } = await jwtVerify(token, signingKey(), { issuer, audience, algorithms: ["HS256"] });
  if (
    typeof payload.sub !== "string" ||
    typeof payload.userId !== "string" ||
    typeof payload.campaignId !== "string" ||
    typeof payload.startTime !== "number" ||
    typeof payload.durationSeconds !== "number" ||
    typeof payload.jti !== "string"
  ) {
    throw new Error("Invalid claim token.");
  }

  return payload as typeof payload & ClaimPayload;
}