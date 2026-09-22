import { guard, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { listMatches } from "@/lib/matches/list";

export async function GET() {
  return guard(async () => {
    const user = await requireUser();
    return json(await listMatches(user.id));
  });
}
