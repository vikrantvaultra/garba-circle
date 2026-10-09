import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { FREE_SPINS } from "@/lib/constants";
import { BrandHeader } from "@/components/brand/BrandHeader";

const FEATURES = [
  {
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
      </>
    ),
    title: "Spin, don’t swipe",
    body: `Spin the circle and it stops on a real dancer. Your first ${FREE_SPINS} spins are on us.`,
  },
  {
    icon: (
      <>
        <path d="M12 3.5 5 6v5.5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6z" />
        <path d="m9 12 2.2 2.2L15.5 10" />
      </>
    ),
    title: "Numbers stay inside",
    body: "Phone numbers are blocked in every form — typed, spelled out, in Hindi, Marathi or Gujarati, even split across messages.",
  },
  {
    icon: (
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    ),
    title: "Respect is the rule",
    body: "Abuse in any language is filtered before it ever reaches the other person. Report and block are always one tap away.",
  },
  {
    icon: (
      <>
        <path d="M4.5 6.5h15v10h-9l-4 3.5v-3.5h-2z" />
        <path d="M8.5 11h7M8.5 13.5h4" />
      </>
    ),
    title: "Talk it out",
    body: "Send a dandiya and the chat opens straight away. Free, with no timer.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(user.profileComplete ? "/garba" : "/setup");

  return (
    <main className="app-shell flex min-h-dvh flex-col pb-safe">
      <BrandHeader
        size="hero"
        eyebrow={`Navratri ${new Date().getFullYear()}`}
        title={
          <>
            Garba
            <br />
            Circle
          </>
        }
        sub={
          <span className="block max-w-[60%]">
            Nau raat, ek circle. Spin it and find someone to dance the whole night
            with.
          </span>
        }
      >
        {/* The circle's dancers, the same dial the spin wheel uses, resting on the drip. */}
        <div className="animate-rise pointer-events-none absolute -bottom-16 -right-6 [animation-delay:150ms]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/wheel/dial.webp"
            alt=""
            width={170}
            height={170}
            fetchPriority="high"
            draggable={false}
            className="block -rotate-12 rounded-full drop-shadow-[0_12px_14px_rgba(59,29,21,0.4)]"
          />
        </div>
      </BrandHeader>

      <div className="flex flex-1 flex-col justify-center pb-8">
        <p className="animate-rise mt-4 flex items-center gap-2.5 text-[13px] font-extrabold text-choco-2">
          <span className="h-px w-6 bg-brand/40" aria-hidden />
          Nine nights, one circle. Made for Navratri.
        </p>

        <div className="mt-5 space-y-3">
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className="panel animate-rise flex gap-3.5 p-4"
              style={{ animationDelay: `${120 + i * 70}ms` }}
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                <svg
                  viewBox="0 0 24 24"
                  className="h-[21px] w-[21px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {feature.icon}
                </svg>
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
