import { BottomNav } from "@/components/BottomNav";
import { Bone } from "@/components/Skeleton";

/** Shown the instant the Chat tab is tapped, while the list loads. */
export default function Loading() {
  return (
    <main aria-busy="true" className="app-shell min-h-dvh pt-safe pb-32">
      <header className="py-4">
        <h1 className="font-display text-[26px] leading-none text-gold">Your chats</h1>
        <Bone className="mt-2 h-[16px] w-32 rounded-md" />
      </header>
      <div className="space-y-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="panel flex items-center gap-3 p-3.5">
            <Bone className="h-[54px] w-[54px] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className="h-[16px] w-1/2 rounded-md" />
              <Bone className="h-[13px] w-4/5 rounded-md" />
            </div>
          </div>
        ))}
      </div>
      <BottomNav />
    </main>
  );
}
