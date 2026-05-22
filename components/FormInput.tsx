"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FormInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  /** When the input is `type="password"`, show a visibility toggle button. */
  showPasswordToggle?: boolean;
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      label,
      error,
      hint,
      icon,
      showPasswordToggle,
      className,
      id: idProp,
      type = "text",
      onFocus,
      onBlur,
      onChange,
      ...props
    },
    ref
  ) => {
    const reactId = React.useId();
    const id = idProp ?? `field-${reactId}`;
    const [focused, setFocused] = React.useState(false);
    const [showPassword, setShowPassword] = React.useState(false);

    const isPassword = type === "password";
    const effectiveType =
      isPassword && showPasswordToggle && showPassword ? "text" : type;

    return (
      <div className="w-full">
        {/* Static label — clean, always readable, no animation jank */}
        <label
          htmlFor={id}
          className={cn(
            "mb-1.5 block text-[11px] font-medium uppercase tracking-[0.16em] transition-colors duration-200",
            error
              ? "text-rose-700"
              : focused
                ? "text-maroon"
                : "text-ink-muted"
          )}
        >
          {label}
        </label>

        <div
          className={cn(
            "group relative flex items-center overflow-hidden rounded-xl border bg-parchment",
            "transition-[border-color,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            error
              ? "border-rose-400/70 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]"
              : focused
                ? "border-maroon/55 shadow-[0_0_0_3px_rgba(122,31,31,0.10),0_8px_28px_-14px_rgba(122,31,31,0.35)]"
                : "border-parchment-muted hover:border-maroon/30"
          )}
        >
          {/* Left accent bar that grows on focus */}
          <span
            aria-hidden
            className={cn(
              "absolute left-0 top-1/2 h-0 w-[2px] -translate-y-1/2 rounded-full bg-gradient-to-b from-maroon to-saffron transition-all duration-300 ease-out",
              focused && !error && "h-[60%]"
            )}
          />

          {icon && (
            <span
              className={cn(
                "ml-4 flex h-5 w-5 shrink-0 items-center justify-center transition-colors duration-200",
                error
                  ? "text-rose-500"
                  : focused
                    ? "text-maroon"
                    : "text-ink-muted"
              )}
            >
              {icon}
            </span>
          )}

          <input
            ref={ref}
            id={id}
            type={effectiveType}
            placeholder={props.placeholder ?? `Enter your ${label.toLowerCase()}`}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            onChange={onChange}
            className={cn(
              "peer w-full bg-transparent px-4 py-3.5 text-[15px] text-ink outline-none",
              "placeholder:text-ink-muted/55 selection:bg-saffron/30",
              icon && "pl-3",
              isPassword && showPasswordToggle && "pr-12",
              className
            )}
            {...props}
          />

          {isPassword && showPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-parchment-deep hover:text-maroon"
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          )}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {(error || hint) && (
            <motion.p
              key={error ? `e-${error}` : `h-${hint}`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "mt-1.5 pl-1 text-xs",
                error ? "text-rose-700" : "text-ink-muted"
              )}
            >
              {error ?? hint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
FormInput.displayName = "FormInput";
