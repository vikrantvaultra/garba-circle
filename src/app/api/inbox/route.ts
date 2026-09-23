import { guard, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { inboxSummary } from "@/lib/matches/list";

/** Unread count and the newest unread message, polled while the app is open. */
export async function GET() {
  return guard(async () => {
    const user = await requireUser();
    return json(await inboxSummary(user.id));
  });
}
