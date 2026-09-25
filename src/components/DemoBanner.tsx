import { devOtpAllowed, devPaymentsAllowed, isDemoDeployment } from "@/lib/env";

/**
 * A deployed environment running with the sign-in or payment shortcuts on is a
 * demo, not a launch. Say so on every screen rather than letting it look real.
 */
export function DemoBanner() {
  if (!isDemoDeployment()) return null;

  const parts: string[] = [];
  if (devOtpAllowed()) parts.push("codes are shown on screen");
  if (devPaymentsAllowed()) parts.push("payments are simulated");

  return (
    <div className="relative z-20 bg-choco px-4 py-1.5 text-center text-[11.5px] font-bold leading-snug text-white">
      DEMO {"—"} {parts.join(", ")}. Don&rsquo;t share with real users.
    </div>
  );
}
