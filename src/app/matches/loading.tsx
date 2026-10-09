import { BottomNav } from "@/components/BottomNav";
import { Bone } from "@/components/Skeleton";
import { BrandHeader } from "@/components/brand/BrandHeader";

/** Shown the instant the Chat tab is tapped, while the list loads. */
export default function Loading() {
  return (
    <main aria-busy="true" className="app-shell min-h-dvh pb-32">
      <BrandHeader title="Your chats" sub={<span className="block h-[20px]" />} />
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
