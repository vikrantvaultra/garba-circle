"use client";

/* eslint-disable @next/next/no-img-element */

import { SKILL_LEVELS } from "@/lib/constants";

export type PublicProfile = {
  id: string;
  name: string | null;
  gender: string | null;
  age: number | null;
  city: string | null;
  state: string | null;
  bio: string | null;
  danceStyles: string[];
  skillLevel: string | null;
  avatarUrl: string | null;
};

const GRADIENTS = [
  "from-marigold via-rani to-magenta",
  "from-rani via-royal to-peacock",
  "from-peacock via-royal to-magenta",
  "from-marigold-deep via-magenta to-plum-2",
];

function pickGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

/**
 * The payoff of a spin, so it is built like one: a full-bleed portrait with a
 * scrim carrying the name, rather than a small avatar in a row of text.
 */
export function ProfileCard({
  profile,
  myStyles = [],
  footer,
}: {
  profile: PublicProfile;
  /** The viewer's own dance styles, used to surface what they share. */
  myStyles?: string[];
  footer?: React.ReactNode;
}) {
  const level = SKILL_LEVELS.find((l) => l.key === profile.skillLevel);
  const shared = profile.danceStyles.filter((s) => myStyles.includes(s));
  const place = [profile.city, profile.state].filter(Boolean).join(", ");
  const initial = (profile.name ?? "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="panel overflow-hidden p-0">
      {/* Marigold garland across the top */}
      <div className="flex h-1.5 w-full">
        <span className="flex-1 bg-marigold" />
        <span className="flex-1 bg-rani" />
        <span className="flex-1 bg-peacock" />
        <span className="flex-1 bg-marigold-deep" />
      </div>

      <div className="relative aspect-[4/5] max-h-[380px] w-full overflow-hidden">
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={profile.name ?? "Dancer"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={`grid h-full w-full place-items-center bg-gradient-to-br ${pickGradient(profile.name ?? "x")}`}
          >
            <span className="font-display text-[110px] font-extrabold leading-none text-night/35">
              {initial}
            </span>
          </div>
        )}

        {/* Scrim so the name stays readable over any photo */}
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#0d0217] via-[#0d0217cc] to-transparent" />

        {level && (
          <span className="absolute right-3 top-3 rounded-full border border-gold/40 bg-night/75 px-3 py-1.5 text-[11.5px] font-bold tracking-wide text-marigold backdrop-blur-md">
            {level.label}
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 p-4">
          <h2 className="font-display text-[30px] font-extrabold leading-none drop-shadow-lg">
            {profile.name ?? "A dancer"}
            {profile.age ? (
              <span className="ml-2.5 text-[22px] font-bold text-cream/80">
                {profile.age}
              </span>
            ) : null}
          </h2>
          {place && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[14px] font-medium text-cream/80">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-marigold" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
                <circle cx="12" cy="10" r="2.6" />
              </svg>
              {place}
            </p>
          )}
        </div>
      </div>

      <div className="p-4">
        {shared.length > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-2xl border border-peacock/35 bg-peacock/10 px-3 py-2.5">
            <span className="text-[14px] text-peacock">{"✦"}</span>
            <p className="text-[13.5px] font-semibold leading-snug text-peacock">
              You both dance {shared.slice(0, 2).join(" & ")}
            </p>
          </div>
        )}

        {profile.bio && (
          <p className="border-l-2 border-marigold/40 pl-3 text-[14.5px] leading-relaxed text-cream/80">
            {profile.bio}
          </p>
        )}

        {profile.danceStyles.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {profile.danceStyles.map((style) => (
              <span
                key={style}
                className={`chip text-[12.5px] ${shared.includes(style) ? "border-peacock/45 text-peacock" : ""}`}
              >
                {style}
              </span>
            ))}
          </div>
        )}

        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </div>
  );
}
