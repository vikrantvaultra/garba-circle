"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./city-picker.module.css";

export type GenderChoice = "female" | "male" | "both";

/** One row in the list: how many of something are there, and how to say it. */
export type PickerCity = { name: string; count: number; countLabel: string };

function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

/**
 * A searchable, single-select city dropdown (the ARIA 1.2 combobox pattern).
 * Type to filter, arrows to move, Enter to pick, Escape to close. Each city
 * carries a real count — dancers on the spin screen, garbas on the map — so
 * nobody picks an empty city without knowing.
 */
export function CityPicker({
  id,
  options,
  value,
  myCity,
  attention,
  placeholder = "Search a city",
  noneText = (q) => `No dancers in ${q} yet. Try a nearby city.`,
  onChange,
}: {
  id: string;
  options: PickerCity[];
  value: string | null;
  placeholder?: string;
  /** Shown when the search matches nothing. */
  noneText?: (query: string) => string;
  /** The viewer's own city, pinned to the top of the list. */
  myCity: string | null;
  /** Briefly highlight the control, e.g. after a spin was tried without a city. */
  attention?: boolean;
  onChange: (city: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const mine = myCity?.trim().toLowerCase() ?? "";
  const q = query.trim().toLowerCase();

  const shown = useMemo(() => {
    const sorted = [...options].sort((a, b) => {
      if (mine) {
        if (a.name.toLowerCase() === mine) return -1;
        if (b.name.toLowerCase() === mine) return 1;
      }
      return b.count - a.count || a.name.localeCompare(b.name);
    });
    if (!q) return sorted;
    const starts = sorted.filter((o) => o.name.toLowerCase().startsWith(q));
    const contains = sorted.filter(
      (o) => !o.name.toLowerCase().startsWith(q) && o.name.toLowerCase().includes(q),
    );
    return [...starts, ...contains];
  }, [options, mine, q]);

  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-opt-${i}`;

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const openList = () => {
    if (open) return;
    setOpen(true);
    setQuery("");
    const selected = value
      ? shown.findIndex((o) => o.name.toLowerCase() === value.toLowerCase())
      : -1;
    setActive(Math.max(0, selected));
    // On a phone the keyboard takes half the screen: bring the field to the
    // top so the list has room underneath it.
    if (window.matchMedia("(max-width: 640px)").matches) {
      wrapRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  };

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const pick = (option: PickerCity | undefined) => {
    if (!option) return;
    onChange(option.name);
    close();
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) openList();
        else setActive((a) => Math.min(a + 1, shown.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) openList();
        else setActive((a) => Math.max(a - 1, 0));
        break;
      case "Home":
        if (open) {
          e.preventDefault();
          setActive(0);
        }
        break;
      case "End":
        if (open) {
          e.preventDefault();
          setActive(shown.length - 1);
        }
        break;
      case "Enter":
        if (open) {
          e.preventDefault();
          pick(shown[active]);
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        break;
      case "Tab":
        close();
        break;
    }
  };

  const hasValue = Boolean(value);

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      data-open={open}
      data-has-value={hasValue}
      data-attention={attention}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <div className={styles.control} onClick={() => inputRef.current?.focus()}>
        <svg className={styles.pin} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.6" />
        </svg>
        <input
          ref={inputRef}
          id={id}
          className={styles.input}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? optionId(active) : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          placeholder={value ?? placeholder}
          value={open ? query : (value ?? "")}
          onFocus={openList}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            if (!open) setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        {hasValue && !open ? (
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={`Clear ${value}`}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              inputRef.current?.focus();
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            tabIndex={-1}
            className={`${styles.iconBtn} ${styles.chevron}`}
            aria-label={open ? "Close city list" : "Open city list"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              if (open) {
                close();
                inputRef.current?.blur();
              } else {
                inputRef.current?.focus();
              }
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </div>

      {open && (
        // Keep focus in the input while tapping inside the panel.
        <div className={styles.panel} onMouseDown={(e) => e.preventDefault()}>
          {shown.length === 0 ? (
            <p className={styles.none}>{noneText(query.trim())}</p>
          ) : (
            <ul ref={listRef} id={listId} role="listbox" aria-label="Cities" className={styles.list}>
              {shown.map((option, i) => {
                const selected = value?.toLowerCase() === option.name.toLowerCase();
                const n = option.count;
                return (
                  <li
                    key={option.name}
                    id={optionId(i)}
                    data-index={i}
                    role="option"
                    aria-selected={selected}
                    data-active={i === active}
                    data-empty={n === 0}
                    className={styles.option}
                    onMouseMove={() => i !== active && setActive(i)}
                    onClick={() => pick(option)}
                  >
                    <span className={styles.name}>
                      <Highlight text={option.name} query={q} />
                      {option.name.toLowerCase() === mine && (
                        <span className={styles.tag}>Your city</span>
                      )}
                    </span>
                    <span className={styles.count}>{option.countLabel}</span>
                    {selected ? (
                      <svg className={styles.check} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    ) : (
                      <span className={styles.check} aria-hidden />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
