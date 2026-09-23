import { BottomNav } from "@/components/BottomNav";
import { Bone } from "@/components/Skeleton";

/** Shown the instant the You tab is tapped, while the profile loads. */
export default function Loading() {
  return (
    <main aria-busy="true" className="app-shell min-h-dvh pt-safe pb-32">
      <header className="py-4">
        <h1 className="font-display text-[26px] leading-none text-gold">You</h1>
      </header>
      <section className="panel p-5">
        <div className="flex items-center gap-4">
          <Bone className="h-[76px] w-[76px] shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Bone className="h-[22px] w-2/3 rounded-md" />
            <Bone className="h-[14px] w-1/2 rounded-md" />
          </div>
        </div>
        <Bone className="mt-5 h-[50px]" />
      </section>
      <section className="mt-4 grid grid-cols-2 gap-3">
        <Bone className="h-[84px] rounded-[22px]" />
        <Bone className="h-[84px] rounded-[22px]" />
      </section>
      <Bone className="mt-4 h-[300px] rounded-[22px]" />
      <BottomNav />
    </main>
  );
}
