import { Bone } from "@/components/Skeleton";
import { Wordmark } from "@/components/brand/Wordmark";

/** Shown the instant "Edit profile" is tapped, while the form loads. */
export default function Loading() {
  return (
    <main aria-busy="true" className="app-shell flex min-h-dvh flex-col pt-safe pb-safe">
      <header className="py-5">
        <Wordmark tone="red" width={76} className="mb-4" />
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-1.5 flex-1 rounded-full bg-choco/10" />
          ))}
        </div>
        <Bone className="mt-3 h-[14px] w-40 rounded-md" />
      </header>
      <Bone className="h-[34px] w-3/5 rounded-md" />
      <Bone className="mt-3 h-[40px] w-full rounded-md" />
      <Bone className="mx-auto mt-8 h-[132px] w-[132px] rounded-full" />
    </main>
  );
}
