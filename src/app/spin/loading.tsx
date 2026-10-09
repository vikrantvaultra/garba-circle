import { BottomNav } from "@/components/BottomNav";
import { Bone } from "@/components/Skeleton";
import { BrandHeader } from "@/components/brand/BrandHeader";
import styles from "./spin.module.css";

/** Shown the instant the Spin tab is tapped, while the circle renders. */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="app-shell min-h-dvh pb-[calc(env(safe-area-inset-bottom,0px)+120px)]"
    >
      <BrandHeader
        title="Garba Circle"
        sub={<span className="block h-[18px]" />}
        watermark={{ text: "ગરબા", lang: "gu" }}
        aside={<span className="block h-[34px] w-[118px] rounded-full bg-white/15" />}
      />
      <Bone className="h-[20px] w-3/4 rounded-md" />
      <div className={styles.prefs}>
        <Bone className="h-[18px] w-44 rounded-md" />
        <Bone className="mt-2.5 h-[52px]" />
        <Bone className="mt-5 h-[18px] w-48 rounded-md" />
        <Bone className="mt-2.5 h-[52px] rounded-full" />
      </div>
      <div className="mx-auto mt-[30px] aspect-square w-[min(340px,86vw)] rounded-full border-[3px] border-dotted border-havmor/40 p-[21%]">
        <Bone className="h-full w-full rounded-full" />
      </div>
      <BottomNav />
    </main>
  );
}
