"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import * as inbox from "@/lib/client/inbox";

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

export function BottomNav({ badge: rendered = 0 }: { badge?: number }) {
  const pathname = usePathname();
  // The live count once the app has checked; until then, what the page had.
  const live = useSyncExternalStore(inbox.subscribe, inbox.getSnapshot, inbox.getServerSnapshot);
  const badge = live ?? rendered;

  return (
    <nav
      aria-label="Main"
      className="fixed left-1/2 z-20 grid w-[min(400px,calc(100%-32px))] -translate-x-1/2 grid-cols-4 gap-1 rounded-full border border-choco/8 bg-white p-1.5 shadow-[0_14px_34px_-10px_rgba(89,51,42,0.45)]"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
    >
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="rounded-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-havmor"
          >
            <NavItem active={active} label={item.label}>
              <span className="relative">
                <svg
                  viewBox="0 0 24 24"
                  className="h-[22px] w-[22px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {item.icon}
                </svg>
                {item.href === "/matches" && badge > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full border-2 border-white bg-mango px-1 text-[10px] font-black text-choco">
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
      className={`flex flex-col items-center gap-0.5 rounded-full pb-[7px] pt-[8px] text-[12px] font-extrabold transition-colors duration-150 ${
        on ? "bg-havmor text-white" : "text-cocoa"
      }`}
    >
      {children}
      {label}
    </span>
  );
}
