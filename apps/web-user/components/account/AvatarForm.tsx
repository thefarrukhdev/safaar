"use client";

import { useState } from "react";
import { uploadAvatarAction, deleteAvatarAction } from "@/lib/account/actions";
import { Button } from "@/components/ui/Button";
import type { ProfileView } from "@/types/view";
import { useRouter } from "next/navigation";

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
      alert(res?.error || dict?.uploadFailed || "Upload failed");
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
      alert(res?.error || dict?.deleteFailed || "Delete failed");
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="h-16 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        {profile.avatarUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profile.avatarUrl}
              alt="Avatar"
              className="h-full w-full object-cover"
            />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            {profile.firstName?.[0]}
            {profile.lastName?.[0]}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <label className="relative cursor-pointer rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-500">
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
            variant="secondary"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
