"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { PackSheet } from "@/components/PackSheet";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/client/api";
import type { PublicProfile } from "@/lib/api";
import {
  FREE_CHAT_SECONDS,
  SKILL_LEVELS,
  SPIN_PACKS,
  rupees,
  CHAT_PACKS,
} from "@/lib/constants";

export function ProfileScreen({
  profile,
  phoneMasked,
  quota,
  strikes,
}: {
  profile: PublicProfile;
  phoneMasked: string;
  quota: {
    freeRemaining: number;
    paidRemaining: number;
    totalRemaining: number;
  };
  strikes: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [showPacks, setShowPacks] = useState(false);
  const level = SKILL_LEVELS.find((l) => l.key === profile.skillLevel);

  const logout = async () => {
    try {
      await api.post("/api/auth/logout");
      router.replace("/");
      router.refresh();
    } catch {
      toast.show("Could not sign out.", "error");
    }
  };

  return (
    <main className="app-shell min-h-dvh pt-safe pb-32">
      <header className="py-4">
        <h1 className="gold-text font-display text-[26px] font-extrabold leading-none">
          You
        </h1>
      </header>

      <section className="panel p-5">
        <div className="flex items-center gap-4">
          <Avatar src={profile.avatarUrl} name={profile.name} size={76} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-[22px] font-extrabold leading-tight">
              {profile.name}
              {profile.age ? (
                <span className="ml-2 text-[16px] font-semibold text-cream/55">
                  {profile.age}
                </span>
              ) : null}
            </h2>
            <p className="truncate text-[14px] text-cream/60">
              {[profile.city, profile.state].filter(Boolean).join(", ")}
            </p>
            <p className="mt-0.5 text-[12.5px] text-cream/40">{phoneMasked}</p>
          </div>
        </div>

        {level && (
          <span className="mt-4 inline-block rounded-full bg-parrot/15 px-3 py-1 text-[12px] font-semibold text-parrot">
            {level.label}
          </span>
        )}

        {profile.bio && (
          <p className="mt-3 border-l-2 border-marigold/40 pl-3 text-[14.5px] leading-relaxed text-cream/75">
            {profile.bio}
          </p>
        )}

        {profile.danceStyles.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {profile.danceStyles.map((style) => (
              <span key={style} className="chip text-[12.5px]">
                {style}
              </span>
            ))}
          </div>
        )}

        <Link href="/setup" className="btn-ghost mt-5">
          Edit profile
        </Link>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="panel p-4 text-center">
          <p className="gold-text font-display text-[30px] font-extrabold leading-none">
            {quota.totalRemaining}
          </p>
          <p className="mt-1 text-[12.5px] text-cream/55">
            spins left
            {quota.paidRemaining > 0 && ` (${quota.paidRemaining} paid)`}
          </p>
        </div>
        <button
          onClick={() => setShowPacks(true)}
          className="panel p-4 text-center transition-transform active:scale-[0.98]"
        >
          <p className="font-display text-[30px] font-extrabold leading-none text-parrot">
            {rupees(SPIN_PACKS[0].amountPaise)}
          </p>
          <p className="mt-1 text-[12.5px] text-cream/55">
            for {SPIN_PACKS[0].grant} more spins
          </p>
        </button>
      </section>

      {strikes > 0 && (
        <section className="mt-4 rounded-2xl border border-rani/40 bg-rani/10 p-4">
          <p className="text-[15px] font-bold text-rani">
            {strikes} rule warning{strikes === 1 ? "" : "s"} on your account
          </p>
          <p className="mt-1 text-[13.5px] leading-snug text-cream/70">
            Keep the circle respectful. Repeated warnings pause your chat, and
            more than that closes the account.
          </p>
        </section>
      )}

      <section className="panel mt-4 divide-y divide-white/8">
        <Item
          title="How the circle works"
          body={`Your first spins are free and random. Buy a pack and you can pick gender and city. Every match gives you ${FREE_CHAT_SECONDS / 60} free minutes of chat, and the clock only runs while you’re both actually talking.`}
        />
        <Item
          title="What we block"
          body="Phone numbers in any form — typed, spelled out, in Devanagari or Gujarati numerals, roman numerals, or split across messages. Plus abusive language in Hindi, Marathi, Gujarati and English."
        />
        <Item
          title="Your number is private"
          body="It is used only to sign you in. It is never shown to another dancer, and never shared."
        />
        <Item
          title="Pricing"
          body={`${SPIN_PACKS.map((p) => `${p.grant} spins ${rupees(p.amountPaise)}`).join(" · ")} · ${CHAT_PACKS.map((p) => `${p.grant / 60} min ${rupees(p.amountPaise)}`).join(" · ")}. One-time payments, no subscription.`}
        />
      </section>

      <button onClick={logout} className="btn-ghost mt-4">
        Sign out
      </button>

      <p className="mt-5 text-center text-[12px] leading-relaxed text-cream/35">
        Garba Circle {"·"} Made for Navratri
        <br />
        Dance safe, dance a lot.
      </p>

      <PackSheet
        open={showPacks}
        title="More spins"
        subtitle="Packs also unlock gender and city filters on every paid spin."
        packs={SPIN_PACKS}
        onClose={() => setShowPacks(false)}
        onPurchased={() => {
          setShowPacks(false);
          router.refresh();
        }}
      />

      <BottomNav />
    </main>
  );
}

function Item({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-4">
      <h3 className="text-[15px] font-bold">{title}</h3>
      <p className="mt-1 text-[13.5px] leading-snug text-cream/60">{body}</p>
    </div>
  );
}
