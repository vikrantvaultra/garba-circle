import { guard, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { circleStats } from "@/lib/stats";

export async function GET() {
  return guard(async () => {
    const user = await requireUser();
    return json(await circleStats({ city: user.city }));
  });
}
