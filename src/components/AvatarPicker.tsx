"use client";

import { useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { useToast } from "./Toast";
import { api } from "@/lib/client/api";

const TARGET_PX = 512;
const QUALITY = 0.82;

/**
 * Crops to a centre square and re-encodes to WebP in the browser, so what
 * reaches the server is ~30 KB instead of a 6 MB phone photo. That is what
 * makes storing avatars on a free-tier database reasonable.
 */
async function compress(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_PX;
  canvas.height = TARGET_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, TARGET_PX, TARGET_PX);
  bitmap.close();

  const webp = canvas.toDataURL("image/webp", QUALITY);
  // Older Safari ignores the WebP request and hands back a PNG.
  return webp.startsWith("data:image/webp")
    ? webp
    : canvas.toDataURL("image/jpeg", QUALITY);
}

export function AvatarPicker({
  value,
  name,
  onChange,
}: {
  value: string | null;
  name: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.show("Please choose an image.", "error");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await compress(file);
      const res = await api.post<{ avatarUrl: string }>(
        "/api/profile/avatar",
        { dataUrl },
      );
      onChange(res.avatarUrl);
      toast.show("Looking good!", "success");
    } catch (error) {
      toast.show(
        error instanceof Error ? error.message : "Could not upload that photo.",
        "error",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="relative"
        aria-label="Choose a profile photo"
      >
        <span className="absolute inset-0 -z-10 animate-pulse-ring rounded-full border-2 border-havmor/40" />
        <Avatar src={value} name={name || "?"} size={132} />
        <span className="absolute bottom-1 right-1 grid h-10 w-10 place-items-center rounded-full border-[3px] border-vanilla bg-havmor text-white shadow-lg">
          {busy ? (
            <span className="text-[13px] font-bold">{"…"}</span>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8.5h3l1.6-2.2h6.8L17 8.5h3v10H4z" />
              <circle cx="12" cy="13" r="3.2" />
            </svg>
          )}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />

      <p className="mt-3 text-center text-[13px] font-semibold text-choco-2">
        {value ? "Tap to change your photo" : "Add a clear photo of yourself"}
      </p>
    </div>
  );
}
