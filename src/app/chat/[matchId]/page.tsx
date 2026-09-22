import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { loadMatchFor, wasInitiatedBy } from "@/lib/chat/match";
import { getMeter } from "@/lib/chat/billing";
import { publicProfile } from "@/lib/api";
import { isChatBanned } from "@/lib/moderation/record";
import { ChatScreen } from "./ChatScreen";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const context = await loadMatchFor(user.id, matchId);
  if (!context) notFound();

  const [meter, initiatedByMe] = await Promise.all([
    getMeter(matchId, user.id),
    wasInitiatedBy(user.id, context.partner.id),
  ]);

  return (
    <ChatScreen
      matchId={matchId}
      partner={publicProfile(context.partner)}
      initialMeter={meter}
      chatBanned={isChatBanned(user)}
      initiatedByMe={initiatedByMe}
    />
  );
}
