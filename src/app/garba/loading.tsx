import { BottomNav } from "@/components/BottomNav";
import { Bone } from "@/components/Skeleton";
import styles from "./garba.module.css";

/** Shown the instant the Garba tab is tapped, while the map page renders. */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="app-shell min-h-dvh pb-[calc(env(safe-area-inset-bottom,0px)+120px)] pt-[calc(env(safe-area-inset-top,0px)+28px)]"
    >
      <Bone className="h-[66px] rounded-[18px]" />
      <header className={`${styles.top} mt-7`}>
        <p className={styles.gu} lang="gu" aria-hidden>
          ગરબા
        </p>
        <h1>Where&rsquo;s the garba?</h1>
        <Bone className="mt-3 h-[18px] w-4/5 rounded-md" />
      </header>
      <div className="mt-[22px]">
        <Bone className="h-[18px] w-28 rounded-md" />
        <Bone className="mt-2.5 h-[52px]" />
      </div>
      <div className="mt-4 ml-[calc(50%-50vw)] h-[min(60dvh,520px)] min-h-[340px] w-screen bg-[#f2efe9]" />
      <BottomNav />
    </main>
  );
}
