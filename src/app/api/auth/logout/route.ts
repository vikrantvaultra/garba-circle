import { guard, json } from "@/lib/api";
import { destroySession } from "@/lib/auth/session";

export async function POST() {
  return guard(async () => {
    await destroySession();
    return json({ ok: true });
  });
}
