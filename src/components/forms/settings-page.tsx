import Link from "next/link";
import { loadWorkspace } from "@/lib/data";
import { SafeSignOut } from "@/components/notes/safe-sign-out";
import { Surface } from "@/components/ui/primitives";
import { ThemeControl } from "@/components/shell/theme-control";
import { ProfileForm } from "./profile-form";
export async function SettingsPage() {
  const { profile, email } = await loadWorkspace();
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Settings</h1>
        </div>
      </div>
      <div className="settings-stack">
        <Surface className="settings-section">
          <h2>Profile</h2>
          <ProfileForm profile={profile} />
        </Surface>
        <Surface className="settings-section">
          <h2>Appearance</h2>
          <ThemeControl expanded />
          <p className="field-help">
            System follows your Mac. Appearance is remembered on this browser.
          </p>
        </Surface>
        <Surface className="settings-section">
          <h2>Account</h2>
          <p className="account-email">{email}</p>
          <div className="account-actions">
            <Link href="/forgot-password" className="button button--secondary">
              Reset password
            </Link>
            <SafeSignOut />
          </div>
        </Surface>
      </div>
    </div>
  );
}
