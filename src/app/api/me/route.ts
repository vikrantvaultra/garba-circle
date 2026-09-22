import { guard, json } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { quotaFor } from "@/lib/search/engine";
import { maskIndianMobile } from "@/lib/phone-number";
import { isChatBanned } from "@/lib/moderation/record";

export async function GET() {
  return guard(async () => {
    const user = await getCurrentUser();
    if (!user) return json({ signedIn: false });

    return json({
      signedIn: true,
      user: {
        id: user.id,
        phoneMasked: maskIndianMobile(user.phone),
        name: user.name,
        gender: user.gender,
        age: user.age,
        city: user.city,
        state: user.state,
        bio: user.bio,
        danceStyles: user.danceStyles ?? [],
        skillLevel: user.skillLevel,
        avatarUrl: user.avatarUrl,
        profileComplete: user.profileComplete,
        strikes: user.strikes,
        chatBanned: isChatBanned(user),
        suspended: Boolean(user.suspendedAt),
      },
      quota: quotaFor(user),
    });
  });
}
