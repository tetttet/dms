import { listConnectionStatuses } from "@/lib/db/queries";
import { apiError } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) return Response.json({ error: "Login required." }, { status: 401 });
  try {
    return Response.json({ connections: await listConnectionStatuses() });
  } catch (reason) {
    return apiError(reason);
  }
}
