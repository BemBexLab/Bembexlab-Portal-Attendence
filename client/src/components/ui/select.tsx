"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

export function Select({ value, options, onChange, placeholder = "Select", ariaLabel, className, triggerClassName, menuMinWidth = 180, disabled = false }: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  triggerClassName?: string;
  menuMinWidth?: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value);
  const positionMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return false;
    setPosition({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    return true;
  };

  const toggleMenu = () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (positionMenu()) setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!(event.target as Element).closest("[data-custom-select]")) setOpen(false);
    };
    positionMenu();
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open]);

  return <div className={cn("relative", className)} data-custom-select>
    <button aria-expanded={open} aria-haspopup="listbox" aria-label={ariaLabel} className={cn("flex h-9 min-w-0 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm outline-none transition hover:bg-muted/40 focus:ring-2 focus:ring-ring/20 disabled:cursor-wait disabled:opacity-60", triggerClassName)} disabled={disabled} onClick={toggleMenu} ref={triggerRef} type="button">
      <span className={cn("min-w-0 truncate", !selected && "text-muted-foreground")}>{selected?.label ?? placeholder}</span>
      <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
    </button>
    {open && typeof document !== "undefined" ? createPortal(
      <div className="fixed z-[100] max-h-60 overflow-y-auto rounded-lg border border-border bg-background p-1.5 shadow-xl" data-custom-select role="listbox" style={{ top: position.top, left: position.left, width: Math.max(position.width, menuMinWidth) }}>
        {options.map((option) => <button aria-selected={option.value === value} className={cn("flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted", option.value === value && "bg-muted font-medium")} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }} role="option" type="button"><span className="truncate">{option.label}</span>{option.value === value ? <Check className="size-4 shrink-0" /> : null}</button>)}
      </div>, document.body) : null}
  </div>;
}
