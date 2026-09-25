import { HAVMOR_STORE_LOCATOR, type Flavour } from "@/lib/havmor";
import { Scoop } from "./Scoop";
import styles from "./brand.module.css";

/** Tonight's Havmor flavour, with where to read about it and where to get one. */
export function FlavourCard({
  flavour,
  label,
  className = "",
}: {
  flavour: Flavour;
  label: string;
  className?: string;
}) {
  return (
    <section className={`${styles.flavour} ${className}`} aria-label={label}>
      <div className={styles.flavourArt} style={{ background: flavour.deep }}>
        <Scoop flavour={flavour} size={78} />
      </div>
      <div className={styles.flavourBody}>
        <p className="eyebrow text-havmor">{label}</p>
        <h2 className={styles.flavourName}>{flavour.name}</h2>
        <p className={styles.flavourNote}>{flavour.note}</p>
        <p className={styles.flavourLinks}>
          <a href={flavour.url} target="_blank" rel="noopener noreferrer">
            {flavour.palette} range {"↗"}
          </a>
          <a href={HAVMOR_STORE_LOCATOR} target="_blank" rel="noopener noreferrer">
            Find a parlour {"↗"}
          </a>
        </p>
      </div>
    </section>
  );
}
