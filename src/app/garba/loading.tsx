import { BottomNav } from "@/components/BottomNav";
import { Bone } from "@/components/Skeleton";
import { BrandHeader } from "@/components/brand/BrandHeader";
import styles from "./garba.module.css";

/** Shown the instant the Garba tab is tapped, while the map page renders. */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="app-shell min-h-dvh pb-[calc(env(safe-area-inset-bottom,0px)+120px)]"
    >
      <BrandHeader
        eyebrow="Havmor Garba Circle"
        title={<>Where&rsquo;s the garba?</>}
        sub={<span className="block h-[20px]" />}
        watermark={{ text: "ગરબા", lang: "gu" }}
      />
      <Bone className="h-[66px] rounded-[20px]" />
      <div className={styles.picker}>
        <Bone className="h-[18px] w-28 rounded-md" />
        <Bone className="mt-2.5 h-[52px]" />
      </div>
      <div className="mt-4 ml-[calc(50%-50vw)] h-[min(60dvh,520px)] min-h-[340px] w-screen bg-cream" />
      <BottomNav />
    </main>
  );
}
