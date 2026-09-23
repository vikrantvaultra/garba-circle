import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { quotaFor } from "@/lib/search/engine";
import { maskIndianMobile } from "@/lib/phone-number";
import { publicProfile } from "@/lib/api";
import { packsOnSale } from "@/lib/constants";
import { ProfileScreen } from "./ProfileScreen";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profileComplete) redirect("/setup");

  return (
    <ProfileScreen
      profile={publicProfile(user)}
      phoneMasked={maskIndianMobile(user.phone)}
      quota={quotaFor(user)}
      packs={packsOnSale()}
      strikes={user.strikes}
    />
  );
}
