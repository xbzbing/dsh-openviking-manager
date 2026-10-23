/**
 * Test-only stand-in for `@deepseek-ai/dsh-client-ui-primitives`.
 *
 * The browser fixture (`lib/standalone.js`) is a self-contained IIFE built for
 * Playwright: it has no module loader and no shell, so the platform screens a
 * real install provides do not exist there. `scripts/build-client.mjs` aliases
 * the package to this file for that build only; the shipped client bundle keeps
 * the real package external.
 *
 * Fidelity matters here, because the e2e suite drives these controls: the shim
 * renders the same accessible shapes (a menu with `role="menuitem"` rows, a
 * segmented control with `role="tab"`/`role="tabpanel"`), and no behaviour the
 * tests rely on is stubbed out.
 */
import type { JSX, ReactNode } from "react";

export interface MenuItem {
  id: string;
  label: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  submenu?: readonly MenuItem[];
}
export interface MenuSeparator {
  type: "separator";
  id: string;
}
export interface MenuLabel {
  type: "label";
  id: string;
  text: string;
}
export type MenuEntry = MenuItem | MenuSeparator | MenuLabel;

function isItem(entry: MenuEntry): entry is MenuItem {
  return "label" in entry;
}

export function Menu(props: {
  open: boolean;
  anchor: ReactNode;
  items?: readonly MenuEntry[];
  selectedId?: string | undefined;
  onSelect?: (id: string) => void;
  onClose: () => void;
  align?: "start" | "end";
  side?: "bottom" | "top" | "right";
  portal?: boolean;
  dense?: boolean;
  compact?: boolean;
  selection?: "check" | "fill";
}): JSX.Element {
  return (
    <>
      {props.anchor}
      {props.open ? (
        <div className="ovm-shimMenu" role="menu">
          {(props.items ?? []).filter(isItem).map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              aria-checked={props.selectedId === item.id}
              disabled={item.disabled}
              className={props.selectedId === item.id ? "ovm-shimMenuItem ovm-shimMenuItem--selected" : "ovm-shimMenuItem"}
              onClick={() => props.onSelect?.(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

export interface SegmentedControlOption {
  value: string;
  label: string;
  disabled?: boolean;
  title?: string;
}

export function SegmentedControl(props: {
  id: string;
  value: string;
  options: readonly SegmentedControlOption[];
  onChange: (next: string) => void;
  label: string;
  disabled?: boolean;
  className?: string | undefined;
}): JSX.Element {
  return (
    <div className={props.className ?? "ovm-shimSegmented"} role="tablist" aria-label={props.label}>
      {props.options.map((option) => (
        <button
          key={option.value}
          id={`${props.id}-${option.value}`}
          type="button"
          role="tab"
          aria-selected={props.value === option.value}
          aria-controls={`${props.id}-${option.value}-panel`}
          disabled={props.disabled === true || option.disabled === true}
          title={option.title}
          className={props.value === option.value ? "ovm-shimSegment ovm-shimSegment--active" : "ovm-shimSegment"}
          onClick={() => props.onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function IconChevronDownOutlineRegular(props: { readonly size?: number; readonly className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width={props.size ?? 16} height={props.size ?? 16} aria-hidden="true" className={props.className}>
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
