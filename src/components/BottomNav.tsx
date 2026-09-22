"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    href: "/spin",
    label: "Spin",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
        <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
      </>
    ),
  },
  {
    href: "/matches",
    label: "Circle",
    icon: (
      <>
        <path d="M12 20.5s-7.5-4.6-7.5-9.7A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 7.5 2.8c0 5.1-7.5 9.7-7.5 9.7z" />
      </>
    ),
  },
  {
    href: "/profile",
    label: "You",
    icon: (
      <>
        <circle cx="12" cy="8.5" r="3.6" />
        <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
      </>
    ),
  },
];

export function BottomNav({ badge = 0 }: { badge?: number }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 pb-safe">
      <div className="app-shell">
        <div className="panel mb-3 flex items-center justify-around px-2 py-2">
          {ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-colors"
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <span className="absolute inset-0 rounded-2xl bg-gradient-to-b from-marigold/25 to-transparent" />
                )}
                <span className="relative">
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-[22px] w-[22px] ${active ? "text-marigold" : "text-cream/55"}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {item.icon}
                  </svg>
                  {item.href === "/matches" && badge > 0 && (
                    <span className="absolute -right-2 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-rani px-1 text-[10px] font-bold text-white">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                <span
                  className={`relative font-display text-[11.5px] font-semibold tracking-wide ${
                    active ? "text-marigold" : "text-cream/55"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
