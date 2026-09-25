import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { FREE_SPINS } from "@/lib/constants";
import { HAVMOR_SINCE, NIGHT_FLAVOURS } from "@/lib/havmor";
import { BrandHeader } from "@/components/brand/BrandHeader";
import { Scoop } from "@/components/brand/Scoop";

const FEATURES = [
  {
    icon: "\u{1F3B0}",
    tint: "bg-strawberry/15",
    title: "Spin, don’t swipe",
    body: `Spin the circle and it stops on a real dancer. Your first ${FREE_SPINS} spins are on us.`,
  },
  {
    icon: "\u{1F6E1}️",
    tint: "bg-pista/15",
    title: "Numbers stay inside",
    body: "Phone numbers are blocked in every form — typed, spelled out, in Hindi, Marathi or Gujarati, even split across messages.",
  },
  {
    icon: "\u{1F338}",
    tint: "bg-mango/20",
    title: "Respect is the rule",
    body: "Abuse in any language is filtered before it ever reaches the other person. Report and block are always one tap away.",
  },
  {
    icon: "\u{1F366}",
    tint: "bg-blueberry/12",
    title: "Talk it out, scoop it up",
    body: "Send a dandiya and the chat opens straight away. Free, with no timer. Every jodi comes with a Havmor flavour to share.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(user.profileComplete ? "/garba" : "/setup");

  return (
    <main className="app-shell flex min-h-dvh flex-col pb-safe">
      <BrandHeader
        size="hero"
        eyebrow={`Havmor presents · Navratri ${new Date().getFullYear()}`}
        title={
          <>
            Garba
            <br />
            Circle
          </>
        }
        sub="Nau raat, ek circle, and more scoops of sweetness. Spin it and find someone to dance the whole night with."
      >
        <div className="animate-rise absolute -bottom-9 right-0 [animation-delay:150ms]">
          <div className="animate-wobble origin-bottom">
            <Scoop flavour={NIGHT_FLAVOURS[0]} scoops={3} size={150} className="drop-shadow-[0_12px_14px_rgba(59,29,21,0.35)]" />
          </div>
        </div>
      </BrandHeader>

      <div className="flex flex-1 flex-col justify-center pb-8">
        <p className="animate-rise flex items-center gap-2 text-[13px] font-extrabold text-choco-2">
          <span className="inline-flex -space-x-1.5" aria-hidden>
            {NIGHT_FLAVOURS.slice(0, 5).map((f) => (
              <i
                key={f.key}
                className="h-4 w-4 rounded-full border-2 border-vanilla"
                style={{ background: f.color }}
              />
            ))}
          </span>
          From Ahmedabad, scooping celebrations since {HAVMOR_SINCE}
        </p>

        <div className="mt-5 space-y-3">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className="panel animate-rise flex gap-3.5 p-4"
              style={{ animationDelay: `${120 + i * 70}ms` }}
            >
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[21px] ${feature.tint}`}>
                {feature.icon}
              </div>
              <div className="min-w-0">
                <h2 className="headline text-[16.5px] leading-tight">{feature.title}</h2>
                <p className="mt-0.5 text-[13.5px] leading-snug text-choco-2">{feature.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="animate-rise space-y-3 pb-2" style={{ animationDelay: "420ms" }}>
        <Link href="/login" className="btn-primary active:btn-primary-active">
          Shuru karo {"→"}
        </Link>
        <Link href="/garba" className="btn-ghost">
          See where the garba is
        </Link>
        <p className="text-center text-[12px] leading-relaxed text-cocoa">
          18+ only. By continuing you agree to keep the circle respectful.
        </p>
      </div>
    </main>
  );
}
