"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface CheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  id?: string;
  className?: string;
}

export function Checkbox({ checked, onChange, label, id, className }: CheckboxProps) {
  const reactId = React.useId();
  const cid = id ?? `cb-${reactId}`;
  return (
    <label
      htmlFor={cid}
      className={cn(
        "group inline-flex cursor-pointer items-center gap-2.5 text-sm text-ink-soft transition-colors hover:text-ink",
        className
      )}
    >
      <span className="relative flex h-5 w-5 items-center justify-center">
        <input
          id={cid}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={cn(
            "h-5 w-5 rounded-md border transition-all duration-300",
            checked
              ? "border-maroon bg-maroon"
              : "border-parchment-muted bg-parchment group-hover:border-maroon/40"
          )}
        />
        <AnimatePresence>
          {checked && (
            <motion.span
              key="ck"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Check className="h-3.5 w-3.5 text-parchment" strokeWidth={3.5} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      {label}
    </label>
  );
}
