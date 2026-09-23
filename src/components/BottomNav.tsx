"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

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
    label: "Chat",
    icon: (
      <>
        <path d="M4.5 6.5h15v10h-9l-4 3.5v-3.5h-2z" />
        <path d="M8.5 11h7M8.5 13.5h4" />
      </>
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
      className="fixed left-1/2 z-20 grid w-[min(400px,calc(100%-32px))] -translate-x-1/2 grid-cols-4 gap-1 rounded-[22px] border border-white/8 bg-night/95 p-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.45)]"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
    >
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="rounded-2xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-marigold"
          >
            <NavItem active={active} label={item.label}>
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
            </NavItem>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The tab lights up the moment it is tapped, before the next screen (or its
 * loading skeleton) has arrived, so a tap never looks ignored.
 */
function NavItem({
  active,
  label,
  children,
}: {
  active: boolean;
  label: string;
  children: ReactNode;
}) {
  const { pending } = useLinkStatus();
  const on = active || pending;
  return (
    <span
      className={`flex flex-col items-center gap-1 rounded-2xl pb-[7px] pt-[9px] text-[12px] font-semibold transition-colors duration-150 ${
        on ? "bg-marigold/10 text-marigold" : "text-muted"
      }`}
    >
      {children}
      {label}
    </span>
  );
}
