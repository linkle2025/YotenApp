import type { Metadata } from "next";
import { AdminTabs } from "./admin-tabs";

export const metadata: Metadata = { title: { default: "管理", template: "%s｜管理｜陽てん塾" }, robots: { index: false } };

/** 管理区域（04_骨格 4.10）。各画面で requireAdmin() により管理者だけに限る */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6">
      <AdminTabs />
      <div className="mt-6">{children}</div>
    </div>
  );
}
