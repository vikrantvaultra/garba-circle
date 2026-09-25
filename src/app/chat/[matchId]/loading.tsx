import Link from "next/link";
import { Bone } from "@/components/Skeleton";
import { Drip } from "@/components/brand/BrandHeader";

/** Shown the instant a conversation is tapped, while it loads. */
export default function Loading() {
  return (
    <div aria-busy="true" className="flex h-dvh flex-col">
      <header className="relative z-10 bg-havmor pt-safe text-white">
        <div className="app-shell flex items-center gap-3 py-2.5">
          <Link href="/matches" aria-label="Back" className="-ml-1 p-1.5">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
          <Bone className="h-10 w-10 shrink-0 rounded-full bg-white/25" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Bone className="h-[16px] w-28 rounded-md bg-white/25" />
            <Bone className="h-[12px] w-16 rounded-md bg-white/25" />
          </div>
        </div>
        <Drip />
      </header>
      <div className="app-shell flex-1 space-y-2.5 pb-4 pt-9">
        <Bone className="h-[46px] w-3/5 rounded-2xl" />
        <Bone className="ml-auto h-[46px] w-1/2 rounded-2xl" />
      </div>
      <div className="border-t border-choco/10 bg-white pb-safe">
        <div className="app-shell py-3">
          <Bone className="h-[50px] rounded-full" />
        </div>
      </div>
    </div>
  );
}
