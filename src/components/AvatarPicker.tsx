"use client";

import { useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { PhotoEditor } from "./PhotoEditor";
import { useToast } from "./Toast";
import { api } from "@/lib/client/api";

/**
 * Pick a photo, then crop, straighten and touch it up in the editor before
 * it is uploaded. The editor re-encodes to a 512px WebP in the browser, so
 * what reaches the server is ~30 KB instead of a 6 MB phone photo. That is
 * what makes storing avatars on a free-tier database reasonable.
 */
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
  const [editing, setEditing] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const choose = () => inputRef.current?.click();

  const pick = (file: File | undefined) => {
    // Cleared so picking the same file again still fires a change.
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.show("Please choose an image.", "error");
      return;
    }
    setEditing(file);
  };

  const upload = async (dataUrl: string) => {
    setBusy(true);
    try {
      const res = await api.post<{ avatarUrl: string }>("/api/profile/avatar", { dataUrl });
      onChange(res.avatarUrl);
      setEditing(null);
      toast.show("Looking good!", "success");
    } catch (error) {
      toast.show(error instanceof Error ? error.message : "Could not upload that photo.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={choose}
        disabled={busy}
        className="relative"
        aria-label={value ? "Change your profile photo" : "Choose a profile photo"}
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
      <p className="mt-0.5 text-center text-[12px] text-cocoa">
        You can crop, straighten and add a filter before it&rsquo;s saved.
      </p>

      <PhotoEditor
        file={editing}
        onCancel={() => setEditing(null)}
        onChooseAnother={choose}
        onDone={upload}
      />
    </div>
  );
}
