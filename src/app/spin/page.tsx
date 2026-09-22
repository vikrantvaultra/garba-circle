import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { quotaFor } from "@/lib/search/engine";
import { countPendingInvites } from "@/lib/matches/list";
import { circleStats } from "@/lib/stats";
import { SpinScreen } from "./SpinScreen";

export default async function SpinPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profileComplete) redirect("/setup");

  const [pendingInvites, stats] = await Promise.all([
    countPendingInvites(user.id),
    circleStats({ city: user.city }),
  ]);

  return (
    <SpinScreen
      initialQuota={quotaFor(user)}
      pendingInvites={pendingInvites}
      myStyles={user.danceStyles ?? []}
      stats={stats}
    />
  );
}
