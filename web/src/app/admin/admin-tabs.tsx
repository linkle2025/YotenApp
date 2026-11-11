"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/users", label: "ユーザー" },
  { href: "/admin/kimon", label: "奇門遁甲" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="管理メニュー" className="flex items-center gap-1 border-b border-border">
      <span className="mr-3 font-serif text-lg font-bold">管理</span>
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${active ? "border-primary font-bold text-primary" : "border-transparent text-muted hover:text-text"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
