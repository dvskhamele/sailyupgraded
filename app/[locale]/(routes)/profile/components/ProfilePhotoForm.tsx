"use client";

import { Users } from "@prisma/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon } from "lucide-react";

import { toast } from "sonner";
import { FileUploaderDropzone } from "@/components/ui/file-uploader-dropzone";
import { Button } from "@/components/ui/button";

import { useAvatarContext } from "@/context/avatar-context";
import { updateProfilePhoto } from "@/actions/user/update-profile-photo";
import { useTranslations } from "next-intl";

interface ProfileFormProps {
  data: Users;
}

export function ProfilePhotoForm({ data }: ProfileFormProps) {
  const [savedAvatar, setSavedAvatar] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const t = useTranslations("ProfileForm");

  const router = useRouter();
  const { setAvatar: setAvatarContext } = useAvatarContext();

  const handleUploadSuccess = (newAvatar: string, _key: string) => {
    setPendingAvatar(newAvatar);
  };

  const handleSave = async () => {
    if (!pendingAvatar) return;
    setSaving(true);
    try {
      await updateProfilePhoto(pendingAvatar);
      setSavedAvatar(pendingAvatar);
      setAvatarContext(pendingAvatar);
      setPendingAvatar(null);
      toast.success(t("photoUpdatedDescription"), { duration: 5000 });
      router.refresh();
    } catch (e) {
      console.log(e);
      toast.error(t("photoErrorDescription"), { duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPendingAvatar(null);
  };

  const avatar = savedAvatar ?? data.avatar;
  const previewUrl = pendingAvatar ?? avatar ?? "/images/nouser.png";
  void previewUrl;

  return (
    <div className="flex items-start gap-6">
      <div className="flex min-w-[132px] flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-background">
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="text-center">
          <div className="text-sm font-medium">Avatar</div>
          <div className="text-xs text-muted-foreground">
            {pendingAvatar ? "Ready to save" : avatar ? "Current file attached" : "No file chosen"}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <FileUploaderDropzone
          uploader={"profilePhotoUploader"}
          onUploadSuccess={handleUploadSuccess}
        />
        {pendingAvatar !== null && (
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? "Saving..." : "Save photo"}
            </Button>
            <Button onClick={handleCancel} variant="outline" size="sm" disabled={saving}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
