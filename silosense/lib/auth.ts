import { scryptSync, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { query, queryOne, newId } from "./db";
import type { Plan } from "./plans";

const SESSION_COOKIE = "silosense_session";
const SESSION_DAYS = 30;

const ADMIN_EMAILS = (process.env.SILOSENSE_ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Whether an email is configured as an admin via SILOSENSE_ADMIN_EMAILS.
 * Re-checked on every login (see the login route) rather than only at
 * registration, so promoting or demoting an admin is just an env var edit
 * plus a re-login - no direct database access ever required to bootstrap
 * or recover admin access.
 */
export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, 64);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  plan: Plan;
};

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
    [newId("sess"), userId, hashToken(token), expiresAt.toISOString()]
  );
  return token;
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await queryOne<{
    id: string;
    email: string;
    name: string;
    is_admin: boolean;
    plan: Plan;
    suspended: boolean;
    expires_at: string;
  }>(
    `SELECT u.id as id, u.email as email, u.name as name, u.is_admin as is_admin,
            u.plan as plan, u.suspended as suspended, s.expires_at as expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1`,
    [hashToken(token)]
  );

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  if (row.suspended) return null;

  return { id: row.id, email: row.email, name: row.name, isAdmin: row.is_admin, plan: row.plan };
}

export async function requireAdminUser(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  return user?.isAdmin ? user : null;
}

export async function destroyCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
  }
  await clearSessionCookie();
}

const RESET_TOKEN_MINUTES = 30;

/** Always succeeds silently for unknown emails - callers must not reveal whether an account exists. */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);
  await query(
    `INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
    [newId("reset"), userId, hashToken(token), expiresAt.toISOString()]
  );
  return token;
}

export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const row = await queryOne<{
    id: string;
    user_id: string;
    expires_at: string;
    used: boolean;
  }>(`SELECT id, user_id, expires_at, used FROM password_resets WHERE token_hash = $1`, [
    hashToken(token),
  ]);

  if (!row || row.used) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  await query(`UPDATE password_resets SET used = true WHERE id = $1`, [row.id]);
  return row.user_id;
}

export async function setUserPassword(userId: string, password: string) {
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
    hashPassword(password),
    userId,
  ]);
  // Force re-login everywhere - a reset likely means the old credentials
  // (and any session created with them) shouldn't be trusted any more.
  await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}
