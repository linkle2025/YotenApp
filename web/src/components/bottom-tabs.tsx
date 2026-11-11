"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/home", label: "ホーム", icon: "⌂", match: (p: string) => p === "/home" },
  { href: "/readings/new", label: "つくる", icon: "＋", match: (p: string) => p === "/readings/new" },
  { href: "/readings", label: "記録", icon: "≡", match: (p: string) => p.startsWith("/readings") && p !== "/readings/new" },
  { href: "/me", label: "マイ", icon: "○", match: (p: string) => p.startsWith("/me") },
];

/** スマートフォン用の下部タブ（04_骨格 4.2）。タブレット以上ではヘッダーのメニューを使う */
export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="メインメニュー"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      <ul className="grid grid-cols-4">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center text-xs ${active ? "font-bold text-primary" : "text-muted"}`}
              >
                <span aria-hidden className="text-lg leading-none">
                  {t.icon}
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
