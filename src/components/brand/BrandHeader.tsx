import type { ReactNode } from "react";
import { Wordmark } from "./Wordmark";
import styles from "./brand.module.css";

/** The drip edge on its own, for the bottom of any other red bar. */
export function Drip() {
  return <span className={styles.drip} aria-hidden />;
}

/**
 * The top of every main screen: a full-width band of Havmor red that melts
 * into the page in drips, the way the logo does. Carries the wordmark, the
 * screen's title and anything that belongs up there (`aside`, top right).
 */
export function BrandHeader({
  title,
  eyebrow,
  sub,
  aside,
  watermark,
  size = "compact",
  children,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  sub?: ReactNode;
  aside?: ReactNode;
  /** A word set large and faint behind the title, e.g. ગરબા. */
  watermark?: { text: string; lang: string };
  size?: "hero" | "compact";
  children?: ReactNode;
}) {
  return (
    <header className={styles.header} data-size={size}>
      <div className={`app-shell ${styles.inner}`}>
        {watermark && (
          <p className={styles.watermark} lang={watermark.lang} aria-hidden>
            {watermark.text}
          </p>
        )}
        <div className={styles.row}>
          <Wordmark width={size === "hero" ? 104 : 80} />
          {aside && <div className={styles.aside}>{aside}</div>}
        </div>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
        {sub && <p className={styles.sub}>{sub}</p>}
        {children}
      </div>
    </header>
  );
}
