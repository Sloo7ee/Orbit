"use client";
import { useActionNotification } from "@/components/ui/action-notifications";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/domain/validation";
import { Button } from "@/components/ui/primitives";
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  revision,
  className = "",
  onSuccess,
  successMessage,
  successDetail,
  persistentSuccess = false,
}: {
  action: (form: FormData) => Promise<ActionResult>;
  children?: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  revision?: number;
  className?: string;
  onSuccess?: () => void;
  successMessage?: string;
  successDetail?: string;
  persistentSuccess?: boolean;
}) {
  const router = useRouter();
  const notify = useActionNotification();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult>({});
  const [savedRevision, setRevision] = useState(revision);
  return (
    <form
      className={`orbit-form ${className}`}
      onChange={(e) => {
        e.currentTarget.dataset.dirty = "true";
        if (result.success) setResult({});
      }}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setResult({});
        startTransition(async () => {
          try {
            const response = await action(data);
            setResult(response);
            if (!response.error) {
              form.dataset.dirty = "false";
              if (response.revision) setRevision(response.revision);
              if (!persistentSuccess && (successMessage || response.success)) {
                notify({
                  title: successMessage || response.success!.replace(/\.$/, ""),
                  detail:
                    successDetail ||
                    String(
                      data.get("code") ||
                        data.get("title") ||
                        data.get("name") ||
                        "",
                    ),
                });
              }
              onSuccess?.();
              if (response.redirectTo) {
                router.replace(response.redirectTo);
              }
              router.refresh();
            }
          } catch {
            setResult({
              error:
                "Connection interrupted. Your entries are still here. Please try again.",
            });
          }
        });
      }}
    >
      <fieldset disabled={pending} aria-busy={pending}>
        {savedRevision !== undefined && (
          <input type="hidden" name="revision" value={savedRevision} />
        )}
        {children}
        {result.error && (
          <p className="form-message form-error" role="alert">
            {result.error}
          </p>
        )}
        {persistentSuccess && result.success && (
          <p className="form-message form-success" role="status">
            {result.success}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </fieldset>
    </form>
  );
}
