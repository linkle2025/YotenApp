"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CirclePlus, Compass, House, List, UserRound, type LucideIcon } from "lucide-react";

const TABS: { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean }[] = [
  { href: "/home", label: "ホーム", icon: House, match: (p) => p === "/home" },
  { href: "/readings/new", label: "つくる", icon: CirclePlus, match: (p) => p === "/readings/new" },
  { href: "/readings", label: "記録", icon: List, match: (p) => p.startsWith("/readings") && p !== "/readings/new" },
  { href: "/kimon", label: "吉方位", icon: Compass, match: (p) => p.startsWith("/kimon") },
  { href: "/me", label: "マイ", icon: UserRound, match: (p) => p.startsWith("/me") },
];

/** スマートフォン用の下部タブ（04_骨格 4.2）。タブレット以上ではヘッダーのメニューを使う */
export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="メインメニュー"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-subtle bg-surface/95 px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),6px)] backdrop-blur md:hidden print:hidden"
    >
      <ul className="grid grid-cols-5">
        {TABS.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-13 flex-col items-center justify-center gap-0.5 text-[11px] ${active ? "font-bold text-primary" : "font-medium text-muted"}`}
              >
                <span
                  aria-hidden
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-primary-tint" : ""}`}
                >
                  <Icon size={22} strokeWidth={active ? 2 : 1.8} />
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
