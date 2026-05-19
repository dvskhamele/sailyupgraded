import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import {
  createR2ObjectKey,
  deleteFileFromR2,
  getR2KeyFromPublicUrl,
  getR2ObjectUrl,
  uploadFileToR2,
} from "@/lib/r2";
import {
  isCustomFieldFileMetadata,
  validateCustomFieldFile,
} from "@/lib/storage-validation";
import {
  releaseWorkspaceStorage,
  reserveWorkspaceStorage,
} from "@/lib/workspace-storage";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const validationError = validateCustomFieldFile(file);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const reserved = await reserveWorkspaceStorage(file.size);
  if (!reserved) {
    return NextResponse.json(
      { error: "Workspace storage limit exceeded" },
      { status: 400 },
    );
  }

  const key = createR2ObjectKey(file.name);

  try {
    const body = Buffer.from(await file.arrayBuffer());
    await uploadFileToR2({
      key,
      body,
      contentType: file.type,
    });

    return NextResponse.json({
      url: getR2ObjectUrl(key),
      name: file.name,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    await releaseWorkspaceStorage(file.size);
    console.error("[R2_UPLOAD]", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const metadata = await request.json().catch(() => null);
  if (!isCustomFieldFileMetadata(metadata)) {
    return NextResponse.json({ error: "Invalid file metadata" }, { status: 400 });
  }

  const key = getR2KeyFromPublicUrl(metadata.url);
  if (!key) {
    return NextResponse.json({ error: "Invalid file url" }, { status: 400 });
  }

  try {
    await deleteFileFromR2(key);
    await releaseWorkspaceStorage(metadata.size);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[R2_DELETE]", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
