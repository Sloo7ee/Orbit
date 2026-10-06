import { saveProfile } from "@/lib/actions/workspace";
import type { Profile } from "@/lib/supabase/database.types";
import { ActionForm } from "./action-form";
export function ProfileForm({ profile }: { profile?: Profile }) {
  const zones = Array.from(
    new Set([
      "Asia/Riyadh",
      "UTC",
      ...Intl.supportedValuesOf("timeZone"),
      ...(profile ? [profile.timezone] : []),
    ]),
  ).sort();
  return (
    <ActionForm
      successMessage={profile ? "Settings saved" : "Profile ready"}
      action={saveProfile}
      submitLabel={profile ? "Save profile" : "Continue"}
      revision={profile?.revision ?? 0}
    >
      <label>
        Display name
        <input
          name="display_name"
          autoComplete="name"
          required
          maxLength={80}
          defaultValue={profile?.display_name ?? ""}
          placeholder="Your name"
        />
      </label>
      <label>
        Timezone
        <select
          name="timezone"
          defaultValue={profile?.timezone ?? "Asia/Riyadh"}
        >
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <p className="field-help">
        Used for semester progress and dates. Changing it will update how dates
        are shown.
      </p>
    </ActionForm>
  );
}
