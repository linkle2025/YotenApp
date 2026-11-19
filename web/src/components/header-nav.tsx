"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/home", label: "ホーム", match: (p: string) => p === "/home" },
  { href: "/readings/new", label: "つくる", match: (p: string) => p === "/readings/new" },
  { href: "/readings", label: "記録", match: (p: string) => p.startsWith("/readings") && p !== "/readings/new" },
  { href: "/me", label: "マイページ", match: (p: string) => p.startsWith("/me") },
];

/** タブレット・パソコン用のメニュー（スマートフォンでは下部タブを使う） */
export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="メインメニュー" className="hidden items-center gap-1 rounded-full bg-subtle p-1 text-sm md:flex">
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 transition-colors ${
              active ? "bg-surface font-bold shadow-[0_1px_3px_rgba(31,27,22,.12)]" : "text-muted hover:text-text"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
