"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    href: "/garba",
    label: "Garba",
    icon: (
      <>
        <path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5l-6-2Z" />
        <path d="M9 4.5v13M15 6.5v13" />
      </>
    ),
  },
  {
    href: "/spin",
    label: "Spin",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
      </>
    ),
  },
  {
    href: "/matches",
    label: "Circle",
    icon: (
      <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" />
    ),
  },
  {
    href: "/profile",
    label: "You",
    icon: (
      <>
        <circle cx="12" cy="8.5" r="3.8" />
        <path d="M4.8 20c1.2-3.6 4-5.3 7.2-5.3s6 1.7 7.2 5.3" />
      </>
    ),
  },
];

export function BottomNav({ badge = 0 }: { badge?: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed left-1/2 z-20 grid w-[min(400px,calc(100%-32px))] -translate-x-1/2 grid-cols-4 gap-1 rounded-[22px] border border-white/8 bg-night/85 p-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.45)] backdrop-blur-lg"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
    >
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-1 rounded-2xl pb-[7px] pt-[9px] text-[12px] font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-marigold ${
              active ? "bg-marigold/10 text-marigold" : "text-muted"
            }`}
          >
            <span className="relative">
              <svg
                viewBox="0 0 24 24"
                className="h-[22px] w-[22px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                {item.icon}
              </svg>
              {item.href === "/matches" && badge > 0 && (
                <span className="absolute -right-2.5 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-rani px-1 text-[10px] font-bold text-white">
                  {badge > 9 ? "9+" : badge}
                  <span className="sr-only"> unread</span>
                </span>
              )}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
