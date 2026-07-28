// saesun-care-schedule과 동일한 방식의 "비밀번호 + 세션 쿠키" 관리자 인증.
// Google 로그인(OAuth)을 쓰지 않고, 서버에서 비밀번호만 검증한 뒤
// 서명된 세션 값을 쿠키에 저장한다. 실제 Sheets 접근은 서비스 계정으로 별도 처리.
//
// middleware.ts(Edge Runtime)에서도 동작해야 하므로 Node.js crypto 대신
// Web Crypto API(SubtleCrypto)를 사용한다.

const COOKIE_NAME = "care_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12시간

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET 환경변수가 설정되지 않았습니다.");
  return secret;
}

async function importKey(secret: string) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function sign(value: string): Promise<string> {
  const key = await importKey(getSecret());
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(): Promise<string> {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `admin.${expires}`;
  const sig = await sign(payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [role, expiresStr, sig] = parts;
  const payload = `${role}.${expiresStr}`;
  const expected = await sign(payload);
  if (sig !== expected) return false;
  const expires = Number(expiresStr);
  if (Number.isNaN(expires) || Date.now() > expires) return false;
  return true;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
