import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "dms_session";
export const SESSION_MAX_AGE = 60 * 60 * 12;

function settings() {
  const username = process.env.DASHBOARD_USERNAME;
  const password = process.env.DASHBOARD_PASSWORD;
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  if (!username || !password || !secret || secret.length < 32) return null;
  return { username, password, secret };
}

export function isLoginConfigured() {
  return settings() !== null;
}

function equals(left: string, right: string) {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export function checkCredentials(username: string, password: string) {
  const configured = settings();
  if (!configured) return false;
  const usernameValid = equals(username, configured.username);
  const passwordValid = equals(password, configured.password);
  return usernameValid && passwordValid;
}

function sign(value: string, secret: string, password: string) {
  return createHmac("sha256", secret).update(password).update("\0").update(value).digest("hex");
}

export function createSession() {
  const configured = settings();
  if (!configured) throw new Error("Dashboard login is not configured.");
  const value = `${Math.floor(Date.now() / 1000)}.${randomBytes(16).toString("hex")}`;
  return `${value}.${sign(value, configured.secret, configured.password)}`;
}

export function isValidSession(session: string | undefined) {
  const configured = settings();
  if (!configured || !session) return false;
  const match = /^(\d{10})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(session);
  if (!match) return false;
  const issuedAt = Number(match[1]);
  const now = Math.floor(Date.now() / 1000);
  if (issuedAt > now || now - issuedAt >= SESSION_MAX_AGE) return false;
  return equals(match[3], sign(`${match[1]}.${match[2]}`, configured.secret, configured.password));
}

export async function isAuthenticated() {
  return isValidSession((await cookies()).get(SESSION_COOKIE)?.value);
}
