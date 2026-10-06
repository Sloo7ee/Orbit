"use client";
import { FocusIndicator } from "@/components/focus/focus-summary";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Orbit, Settings2 } from "lucide-react";
import { navigation } from "./navigation";
import { ThemeControl } from "./theme-control";
import { SemesterSwitcher } from "./semester-switcher";
import { SessionRefresh } from "./session-refresh";
import type { Profile, Semester } from "@/lib/supabase/database.types";
export function AppShell({
  children,
  profile,
  semesters,
  selected,
}: {
  children: React.ReactNode;
  profile: Profile;
  semesters: Semester[];
  selected: Semester | null;
}) {
  const pathname = usePathname();
  const current = navigation.find((item) => item.href === pathname);
  return (
    <div className="app-shell">
      <SessionRefresh />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar" aria-label="Sidebar">
        <Link href="/" className="brand" aria-label="Orbit home">
          <span className="brand-mark">
            <Orbit size={27} strokeWidth={1.5} />
          </span>
          <span>
            orbit<span className="brand-dot">.</span>
          </span>
        </Link>
        <SemesterSwitcher semesters={semesters} selected={selected} />
        <div className="nav-caption">WORKSPACE</div>
        <nav aria-label="Main navigation" className="navigation">
          {navigation
            .filter(
              (item) => item.href !== "/settings" && item.href !== "/semesters",
            )
            .map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`nav-link ${pathname === href ? "is-active" : ""}`}
                aria-current={pathname === href ? "page" : undefined}
                title={label}
              >
                <Icon size={19} strokeWidth={1.7} />
                <span>{label}</span>
                {pathname === href && <span className="active-dot" />}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-profile">
            <span className="profile-initial">
              {profile.display_name[0].toUpperCase()}
            </span>
            <span>
              {profile.display_name.split(/\s+/)[0]}
              <small>Personal workspace</small>
            </span>
          </div>
          <Link
            href="/settings"
            className={`nav-link ${pathname === "/settings" ? "is-active" : ""}`}
            aria-current={pathname === "/settings" ? "page" : undefined}
            title="Settings"
          >
            <Settings2 size={19} strokeWidth={1.7} />
            <span>Settings</span>
          </Link>
          <ThemeControl />
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{current?.label ?? "Page not found"}</strong>
          </div>
          <FocusIndicator />
          <span className="topbar-semester">
            {selected?.name ?? "Set up your semester"}
            {selected?.archived_at && <span className="badge">Archived</span>}
          </span>
        </header>
        {selected?.archived_at && (
          <div className="archive-banner">
            Viewing archived semester · {selected.name}
            <Link href="/semesters">Manage history</Link>
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
