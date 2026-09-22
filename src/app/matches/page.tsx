import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listMatches } from "@/lib/matches/list";
import { MatchesScreen } from "./MatchesScreen";

export default async function MatchesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profileComplete) redirect("/setup");

  // Rendered on the server so the list is there on first paint, with no
  // loading skeleton and no fetch-on-mount effect.
  const data = await listMatches(user.id);
  return <MatchesScreen initial={data} />;
}
