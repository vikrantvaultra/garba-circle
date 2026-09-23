import { BottomNav } from "@/components/BottomNav";
import { Bone } from "@/components/Skeleton";
import styles from "./spin.module.css";

/** Shown the instant the Spin tab is tapped, while the circle renders. */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="app-shell min-h-dvh pb-[calc(env(safe-area-inset-bottom,0px)+120px)] pt-[calc(env(safe-area-inset-top,0px)+28px)]"
    >
      <header className={styles.top}>
        <div className={styles.brand}>
          <p className={styles.gu} lang="gu" aria-hidden>
            ગરબા
          </p>
          <h1>Garba Circle</h1>
          <Bone className="mt-3 h-[18px] w-48 rounded-md" />
        </div>
        <Bone className="mt-1 h-[34px] w-[118px] rounded-full" />
      </header>
      <Bone className="mt-5 h-[20px] w-3/4 rounded-md" />
      <div className={styles.prefs}>
        <Bone className="h-[18px] w-44 rounded-md" />
        <Bone className="mt-2.5 h-[52px]" />
        <Bone className="mt-5 h-[18px] w-48 rounded-md" />
        <Bone className="mt-2.5 h-[52px]" />
      </div>
      <div className="mx-auto mt-[34px] aspect-square w-[min(340px,86vw)] rounded-full border-[3px] border-dotted border-marigold/40 p-[21%]">
        <Bone className="h-full w-full rounded-full" />
      </div>
      <BottomNav />
    </main>
  );
}
