"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const MAX_AGENT_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "svg",
] as const;

const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
] as const;

interface ContactPhotoUploaderProps {
  contactId: string;
  initialPhotoUrl?: string | null;
  fullName: string;
  initials: string;
}

export function ContactPhotoUploader({
  contactId,
  initialPhotoUrl,
  fullName,
  initials,
}: ContactPhotoUploaderProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl ?? null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so re-selecting the same file triggers onChange
    e.target.value = "";

    // 1. File size validation
    if (file.size > MAX_AGENT_PHOTO_SIZE_BYTES) {
      toast.error("Image is too large. Please upload a smaller image (max 5MB).");
      return;
    }

    // 2. Extension validation
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !(ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
      toast.error("Please upload a valid image file (JPG, PNG, WebP, GIF, BMP, SVG).");
      return;
    }

    // 3. MIME type validation
    if (
      !file.type ||
      !(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(
        file.type.toLowerCase() as any
      )
    ) {
      toast.error("Please upload a valid image file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/crm/contacts/${contactId}/photo`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok || data.error) {
          toast.error(data.error || "Failed to upload image.");
        } else if (data.photoUrl) {
          setPhotoUrl(data.photoUrl);
          toast.success("Photo updated successfully.");
          router.refresh();
        }
      } catch (err: any) {
        console.error("Photo upload error:", err);
        toast.error(err?.message || "Failed to upload image. Please try again.");
      }
    });
  };

  const handleTriggerUpload = () => {
    if (isPending) return;
    fileInputRef.current?.click();
  };

  const handleRemovePhoto = () => {
    if (isPending || !photoUrl) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/crm/contacts/${contactId}/photo`, {
          method: "DELETE",
        });

        const data = await response.json();

        if (!response.ok || data.error) {
          toast.error(data.error || "Failed to remove photo.");
        } else {
          setPhotoUrl(null);
          toast.success("Photo removed successfully.");
          router.refresh();
        }
      } catch (err: any) {
        console.error("Photo remove error:", err);
        toast.error(err?.message || "Failed to remove photo.");
      }
    });
  };

  return (
    <div className="flex flex-col items-center sm:items-start gap-2.5">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,image/svg+xml"
        className="hidden"
        onChange={handleFileChange}
        disabled={isPending}
      />

      {/* Avatar Container with Hover Overlay */}
      <div
        className="group relative cursor-pointer"
        onClick={handleTriggerUpload}
        title={photoUrl ? "Click to change photo" : "Click to upload photo"}
      >
        <Avatar className="h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32 rounded-xl sm:rounded-2xl border-2 border-border/80 shadow-sm shrink-0 overflow-hidden transition-opacity group-hover:opacity-90">
          <AvatarImage
            src={photoUrl ?? undefined}
            alt={fullName || "Agent Photo"}
            className="aspect-square h-full w-full object-cover"
          />
          <AvatarFallback className="rounded-xl sm:rounded-2xl bg-primary/10 text-primary text-2xl sm:text-3xl font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>

        {/* Hover / Loading Overlay */}
        <div className="absolute inset-0 flex items-center justify-center rounded-xl sm:rounded-2xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          {isPending ? (
            <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-white" />
          ) : (
            <Camera className="h-6 w-6 sm:h-8 sm:w-8 text-white drop-shadow" />
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleTriggerUpload}
          disabled={isPending}
          className="h-8 text-xs font-medium gap-1.5"
        >
          {isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Uploading...</span>
            </>
          ) : photoUrl ? (
            <>
              <Camera className="h-3.5 w-3.5" />
              <span>Change Photo</span>
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Photo</span>
            </>
          )}
        </Button>

        {photoUrl && !isPending && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRemovePhoto}
            disabled={isPending}
            title="Remove photo"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
