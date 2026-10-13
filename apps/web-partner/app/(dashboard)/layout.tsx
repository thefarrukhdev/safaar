import type { ReactNode } from "react";
import { AuthGuard } from "../_components/layout/auth-guard";
import { Sidebar } from "../_components/layout/sidebar";
import { Topbar } from "../_components/layout/topbar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-[var(--background)]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-x-hidden p-4 md:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-[1600px] fade-in">{children}</div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
