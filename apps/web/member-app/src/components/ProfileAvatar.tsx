"use client";

import type { Member } from "@osaja/types";
import { Camera, Loader2, User } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { resolveAvatarUrl } from "@/lib/profile";

interface ProfileAvatarProps {
  member: Pick<Member, "fullName" | "avatarUrl">;
  size?: "md" | "lg" | "xl";
  editable?: boolean;
  uploading?: boolean;
  onUpload?: (file: File) => void;
}

const SIZES = {
  md: { box: "h-16 w-16", text: "text-xl", icon: "h-5 w-5", cam: "h-7 w-7" },
  lg: { box: "h-24 w-24", text: "text-3xl", icon: "h-8 w-8", cam: "h-8 w-8" },
  xl: { box: "h-28 w-28", text: "text-4xl", icon: "h-10 w-10", cam: "h-9 w-9" },
};

export function ProfileAvatar({ member, size = "lg", editable = false, uploading = false, onUpload }: ProfileAvatarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const s = SIZES[size];
  const src = preview ?? resolveAvatarUrl(member.avatarUrl);

  useEffect(() => {
    setPreview(null);
  }, [member.avatarUrl]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setPreview(URL.createObjectURL(file));
    onUpload?.(file);
  };

  return (
    <div className="relative inline-flex shrink-0">
      <div
        className={`${s.box} relative overflow-hidden rounded-2xl bg-brand-navy shadow-md ring-2 ring-white`}
      >
        {src ? (
          <Image src={src} alt={member.fullName} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white">
            <span className={`font-bold ${s.text}`}>{member.fullName.charAt(0).toUpperCase()}</span>
          </div>
        )}
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-brand-navy/60">
            <Loader2 className={`${s.icon} animate-spin text-white`} />
          </div>
        ) : null}
      </div>

      {editable ? (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={`absolute -bottom-1 -right-1 flex ${s.cam} items-center justify-center rounded-full bg-brand-gold text-brand-navy-dark shadow-md ring-2 ring-white transition hover:bg-brand-gold-light disabled:opacity-50`}
            aria-label="Change profile photo"
          >
            <Camera className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </>
      ) : !src ? (
        <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 ring-2 ring-white">
          <User className="h-3.5 w-3.5 text-slate-400" />
        </div>
      ) : null}
    </div>
  );
}
