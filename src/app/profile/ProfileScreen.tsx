"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { NotifySetting } from "@/components/NotifyPrompt";
import { PackSheet } from "@/components/PackSheet";
import { useToast } from "@/components/Toast";
import { BrandHeader } from "@/components/brand/BrandHeader";
import { ProductShot } from "@/components/brand/ProductShot";
import { Wordmark } from "@/components/brand/Wordmark";
import { HAVMOR_HOME, HAVMOR_SINCE, HAVMOR_STORE_LOCATOR, levelFlavour } from "@/lib/havmor";
import { api } from "@/lib/client/api";
import * as push from "@/lib/client/push";
import type { PublicProfile } from "@/lib/api";
import {
  SKILL_LEVELS,
  UNLIMITED_PASS_ENDS_LABEL,
  type Pack,
  rupees,
} from "@/lib/constants";

export function ProfileScreen({
  profile,
  phoneMasked,
  quota,
  packs,
  strikes,
}: {
  profile: PublicProfile;
  phoneMasked: string;
  quota: {
    freeRemaining: number;
    paidRemaining: number;
    totalRemaining: number;
    unlimited: boolean;
  };
  /** Packs on sale right now. */
  packs: Pack[];
  strikes: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [showPacks, setShowPacks] = useState(false);
  const level = SKILL_LEVELS.find((l) => l.key === profile.skillLevel);
  const mine = levelFlavour(profile.skillLevel);
  const pass = packs.find((p) => p.unlimited);
  // The tile offers the pass while it's on sale, else the smallest pack.
  const offer = pass ?? packs[0];
  const packsForSale = quota.unlimited ? packs.filter((p) => !p.unlimited) : packs;

  const logout = async () => {
    try {
      // While still signed in: this device stops getting this account's messages.
      await push.forget();
      await api.post("/api/auth/logout");
      router.replace("/");
      router.refresh();
    } catch {
      toast.show("Could not sign out.", "error");
    }
  };

  return (
    <main className="app-shell min-h-dvh pb-32">
      <BrandHeader title="You" />

      <section className="panel p-5">
        <div className="flex items-center gap-4">
          <Avatar src={profile.avatarUrl} name={profile.name} size={76} />
          <div className="min-w-0 flex-1">
            <h2 className="headline truncate text-[22px] leading-tight">
              {profile.name}
              {profile.age ? (
                <span className="ml-2 text-[16px] font-bold text-cocoa">
                  {profile.age}
                </span>
              ) : null}
            </h2>
            <p className="truncate text-[14px] font-semibold text-choco-2">
              {[profile.city, profile.state].filter(Boolean).join(", ")}
            </p>
            <p className="mt-0.5 text-[12.5px] text-cocoa">{phoneMasked}</p>
          </div>
        </div>

        {level && (
          <span className="mt-4 inline-block rounded-full bg-pista/15 px-3 py-1 text-[12px] font-extrabold text-[#2f6b22]">
            {level.label}
          </span>
        )}

        {profile.bio && (
          <p className="mt-3 border-l-[3px] border-havmor/40 pl-3 text-[14.5px] leading-relaxed text-choco-2">
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

        {mine && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-cream p-3">
            <span
              className="grid h-16 w-[72px] shrink-0 place-items-center rounded-xl p-1.5"
              style={{ background: mine.flavour.tint }}
            >
              <ProductShot flavour={mine.flavour} size={50} className="drop-shadow-[0_5px_6px_rgba(59,29,21,0.22)]" />
            </span>
            <span className="min-w-0">
              <span className="eyebrow block text-havmor">Your flavour</span>
              <b className="headline block text-[16px] leading-tight">{mine.flavour.name}</b>
              <small className="block text-[12.5px] leading-snug text-choco-2">{mine.line}</small>
            </span>
          </div>
        )}

        <Link href="/setup" className="btn-ghost mt-5">
          Edit profile
        </Link>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="panel p-4 text-center">
          <p className="headline text-[30px] leading-none text-havmor">
            {quota.unlimited ? "∞" : quota.totalRemaining}
          </p>
          <p className="mt-1 text-[12.5px] font-semibold text-choco-2">
            {quota.unlimited ? (
              `unlimited till ${UNLIMITED_PASS_ENDS_LABEL}`
            ) : (
              <>
                spins left
                {quota.paidRemaining > 0 && ` (${quota.paidRemaining} paid)`}
              </>
            )}
          </p>
        </div>
        {quota.unlimited || !offer ? (
          <div className="panel p-4 text-center">
            <p className="headline text-[30px] leading-none text-pista">All set</p>
            <p className="mt-1 text-[12.5px] font-semibold text-choco-2">every spin is free</p>
          </div>
        ) : (
          <button
            onClick={() => setShowPacks(true)}
            className="panel p-4 text-center transition-transform active:scale-[0.98]"
          >
            <p className="headline text-[30px] leading-none text-pista">
              {rupees(offer.amountPaise)}
            </p>
            <p className="mt-1 text-[12.5px] font-semibold text-choco-2">
              {offer.unlimited
                ? `unlimited spins till ${UNLIMITED_PASS_ENDS_LABEL}`
                : `for ${offer.grant} more spins`}
            </p>
          </button>
        )}
      </section>

      {strikes > 0 && (
        <section className="mt-4 rounded-2xl border border-havmor/35 bg-havmor-soft p-4">
          <p className="text-[15px] font-black text-havmor">
            {strikes} rule warning{strikes === 1 ? "" : "s"} on your account
          </p>
          <p className="mt-1 text-[13.5px] leading-snug text-choco-2">
            Keep the circle respectful. Repeated warnings pause your chat, and
            more than that closes the account.
          </p>
        </section>
      )}

      <section className="panel mt-4">
        <NotifySetting />
      </section>

      <section className="panel mt-4 divide-y divide-choco/8">
        <Item
          title="How the circle works"
          body={`Pick a city and who you’d like to meet, then spin. Your first 5 spins are free, and a pack only buys more spins. Chatting is always free, with no timer.`}
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
          title="Made with Havmor"
          body={`Havmor has been adding more scoops of sweetness to celebrations since ${HAVMOR_SINCE}, from Ahmedabad. Every jodi here comes with a flavour to share between rounds.`}
        />
        <Item
          title="Pricing"
          body={`${packs.map((p) => (p.unlimited ? `Unlimited spins till ${UNLIMITED_PASS_ENDS_LABEL} ${rupees(p.amountPaise)}` : `${p.grant} spins ${rupees(p.amountPaise)}`)).join(" · ")}. Chat is free. One-time payments, no subscription.`}
        />
      </section>

      <button onClick={logout} className="btn-ghost mt-4">
        Sign out
      </button>

      <footer className="mt-7 flex flex-col items-center gap-2 text-center text-[12px] font-semibold leading-relaxed text-cocoa">
        <Wordmark tone="red" width={84} />
        <p>
          Havmor Garba Circle {"·"} Made for Navratri
          <br />
          Dance safe, dance a lot.
        </p>
        <p className="flex gap-4 font-extrabold text-havmor">
          <a href={HAVMOR_HOME} target="_blank" rel="noopener noreferrer">
            havmor.com {"↗"}
          </a>
          <a href={HAVMOR_STORE_LOCATOR} target="_blank" rel="noopener noreferrer">
            Find a parlour {"↗"}
          </a>
        </p>
      </footer>

      <PackSheet
        open={showPacks}
        title="More spins"
        subtitle="Packs are more spins. City and who you meet stay your choice on every one."
        packs={packsForSale}
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
      <h3 className="text-[15px] font-black">{title}</h3>
      <p className="mt-1 text-[13.5px] leading-snug text-choco-2">{body}</p>
    </div>
  );
}
