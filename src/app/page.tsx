import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { FREE_SPINS } from "@/lib/constants";

const FEATURES = [
  {
    icon: "\u{1F3B0}",
    title: "Spin, don’t swipe",
    body: `Spin the circle and it stops on a real dancer. Your first ${FREE_SPINS} spins are on us.`,
  },
  {
    icon: "\u{1F6E1}️",
    title: "Numbers stay inside",
    body: "Phone numbers are blocked in every form — typed, spelled out, in Hindi, Marathi or Gujarati, even split across messages.",
  },
  {
    icon: "\u{1F338}",
    title: "Respect is the rule",
    body: "Abuse in any language is filtered before it ever reaches the other person. Report and block are always one tap away.",
  },
  {
    icon: "\u{1F4AC}",
    title: "Talk it out",
    body: "Send a dandiya and the chat opens straight away. Chatting is free, with no timer.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(user.profileComplete ? "/garba" : "/setup");

  return (
    <main className="app-shell flex min-h-dvh flex-col pt-safe pb-safe">
      <div className="flex flex-1 flex-col justify-center py-10">
        <header className="animate-rise text-center">
          <div className="mx-auto mb-5 grid h-[86px] w-[86px] place-items-center rounded-[28px] border border-gold/35 bg-gradient-to-br from-plum-2 to-night shadow-[0_18px_40px_-18px_rgba(255,138,0,0.7)]">
            <span className="animate-flicker text-[42px] leading-none">
              {"\u{1FA94}"}
            </span>
          </div>

          <p className="text-[13px] font-semibold uppercase tracking-[0.28em] text-marigold/80">
            Navratri {new Date().getFullYear()}
          </p>
          <h1 className="gold-text mt-1 font-display text-[46px] font-extrabold leading-[1.05]">
            Garba Circle
          </h1>
          <p className="mx-auto mt-3 max-w-[330px] text-[16.5px] leading-relaxed text-cream/75">
            Nau raat, ek circle. Spin it and find someone to dance the
            whole night with.
          </p>
        </header>

        <div className="mt-9 space-y-3">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className="panel animate-rise flex gap-3.5 p-4"
              style={{ animationDelay: `${120 + i * 70}ms` }}
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-marigold/25 to-rani/15 text-[21px]">
                {feature.icon}
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-[16.5px] font-bold leading-tight">
                  {feature.title}
                </h2>
                <p className="mt-0.5 text-[13.5px] leading-snug text-cream/65">
                  {feature.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="animate-rise space-y-3 pb-2"
        style={{ animationDelay: "420ms" }}
      >
        <Link href="/login" className="btn-primary active:btn-primary-active">
          Shuru karo {"→"}
        </Link>
        <Link href="/garba" className="btn-ghost">
          See where the garba is
        </Link>
        <p className="text-center text-[12px] leading-relaxed text-cream/45">
          18+ only. By continuing you agree to keep the circle respectful.
        </p>
      </div>
    </main>
  );
}
