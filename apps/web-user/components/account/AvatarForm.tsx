"use client";

import { useState } from "react";
import { uploadAvatarAction, deleteAvatarAction } from "@/lib/account/actions";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button-variants";
import type { ProfileView } from "@/types/view";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function AvatarForm({
  profile,
  dict,
}: {
  profile: ProfileView;
  dict: Record<string, string | undefined>;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await uploadAvatarAction(formData);
    setLoading(false);

    if (res?.ok) {
      router.refresh();
    } else {
      toast.error(res?.error || dict?.uploadFailed || "Upload failed");
    }
  };

  const handleDelete = async () => {
    if (!confirm(dict?.confirmDelete || "Are you sure?")) return;
    setLoading(true);
    const res = await deleteAvatarAction();
    setLoading(false);
    
    if (res?.ok) {
      router.refresh();
    } else {
      toast.error(res?.error || dict?.deleteFailed || "Delete failed");
    }
  };

  return (
    <div className="flex items-center gap-5 sm:gap-6">
      <div className="flex h-20 w-20 shrink-0 overflow-hidden rounded-full bg-slate-100 text-2xl font-semibold text-slate-500 shadow-inner dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 items-center justify-center">
        {profile.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={profile.avatarUrl}
            alt="Avatar"
            className="h-full w-full object-cover"
          />
        ) : (
          <span>
            {profile.firstName?.[0]}
            {profile.lastName?.[0]}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={buttonVariants({ variant: "secondary", size: "sm", className: "cursor-pointer" }) + (loading ? " opacity-50 pointer-events-none" : "")}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <span>{dict?.upload || "Upload"}</span>
          <input
            type="file"
            className="sr-only"
            accept="image/*"
            onChange={handleUpload}
            disabled={loading}
          />
        </label>
        {profile.avatarUrl && (
          <Button
            variant="ghost"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={handleDelete}
            loading={loading}
            size="sm"
          >
            {dict?.delete || "Delete"}
          </Button>
        )}
      </div>
    </div>
  );
}
