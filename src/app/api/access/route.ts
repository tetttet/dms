import { cookies } from "next/headers";
import { z } from "zod";
import { checkCredentials, createSession, isLoginConfigured, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

const credentialsSchema = z.object({
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(512),
});

export async function POST(request: Request) {
  if (!isLoginConfigured()) {
    return Response.json({ error: "Dashboard login is not configured." }, { status: 503 });
  }
  const input = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!input.success || !checkCredentials(input.data.username, input.data.password)) {
    return Response.json({ error: "Invalid username or password." }, { status: 401 });
  }
  (await cookies()).set(SESSION_COOKIE, createSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return Response.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
