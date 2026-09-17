"use client";

// src/components/PasswordInput.tsx
// Password field with a show/hide toggle (issue B: previously every password
// input was hardcoded type="password" with no way to reveal it).

import { useState, type InputHTMLAttributes } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";

export function PasswordInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Lock
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
      />
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`h-11 w-full rounded-md border border-border bg-bg pl-10 pr-10 text-sm text-fg placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 ${className ?? ""}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-muted transition-colors hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
