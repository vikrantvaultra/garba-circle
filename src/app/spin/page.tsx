import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { quotaFor } from "@/lib/search/engine";
import { tonightFor } from "@/lib/search/tonight";
import { cityOptions } from "@/lib/search/cities";
import { countPendingInvites } from "@/lib/matches/list";
import { circleStats } from "@/lib/stats";
import { navratriLine } from "@/lib/navratri";
import { packsOnSale } from "@/lib/constants";
import { SpinScreen } from "./SpinScreen";

export default async function SpinPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profileComplete) redirect("/setup");

  const [pendingInvites, stats, tonight, cities] = await Promise.all([
    countPendingInvites(user.id),
    circleStats({ city: user.city }),
    tonightFor(user),
    cityOptions(user.id),
  ]);

  return (
    <SpinScreen
      initialQuota={quotaFor(user)}
      pendingInvites={pendingInvites}
      me={{
        city: user.city,
        danceStyles: user.danceStyles ?? [],
        skillLevel: user.skillLevel,
        age: user.age,
      }}
      stats={stats}
      tonight={tonight}
      cities={cities}
      packs={packsOnSale()}
      subtitle={navratriLine()}
    />
  );
}
