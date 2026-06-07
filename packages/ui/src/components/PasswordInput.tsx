"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState, type InputHTMLAttributes } from "react";

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  inputClassName?: string;
  toggleClassName?: string;
  variant?: "light" | "dark";
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { inputClassName = "", toggleClassName, variant = "light", className, ...props },
    ref,
  ) {
    const [visible, setVisible] = useState(false);

    const toggleDefault =
      variant === "dark"
        ? "absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40"
        : "absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30";

    return (
      <div className={className ?? "relative"}>
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className={`${inputClassName} pr-11`.trim()}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((show) => !show)}
          className={toggleClassName ?? toggleDefault}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
        </button>
      </div>
    );
  },
);
