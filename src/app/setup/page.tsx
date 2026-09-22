import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SetupWizard } from "./SetupWizard";

export default async function SetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <SetupWizard
      initial={{
        name: user.name ?? "",
        gender: user.gender ?? "",
        age: user.age ?? null,
        city: user.city ?? "",
        state: user.state ?? "",
        bio: user.bio ?? "",
        danceStyles: user.danceStyles ?? [],
        skillLevel: user.skillLevel ?? "",
        avatarUrl: user.avatarUrl ?? null,
      }}
      editing={user.profileComplete}
    />
  );
}
