/**
 * Minimal ambient surface for the platform controls this panel renders.
 *
 * `@deepseek-ai/dsh-client-ui-primitives` is a web-shell platform seed declared
 * in package.json `dsh.client.inject`: the shell provides it and the plugin
 * bundle keeps it external, so nothing is installed or bundled here. These
 * declarations mirror the parts the panel uses — a dropdown menu and the
 * two-choice control the official cards use in place of a hand-drawn switch.
 *
 * Only the shapes actually consumed are declared: a narrower surface is easier
 * to keep honest than a copy of the platform's whole component library.
 */
declare module "@deepseek-ai/dsh-client-ui-primitives" {
  import type { JSX, ReactNode } from "react";

  /** One selectable row of a {@link Menu}. */
  export interface MenuItem {
    id: string;
    label: ReactNode;
    disabled?: boolean;
    danger?: boolean;
    submenu?: readonly MenuItem[];
  }
  /** A hairline between item groups (not selectable). */
  export interface MenuSeparator {
    type: "separator";
    id: string;
  }
  /** A non-interactive heading row above a group of items. */
  export interface MenuLabel {
    type: "label";
    id: string;
    text: string;
  }
  export type MenuEntry = MenuItem | MenuSeparator | MenuLabel;

  /** Anchored dropdown menu. `open` is controlled; the caller renders the
   * `anchor` trigger itself (including aria-haspopup/aria-expanded) and must
   * close the menu from `onSelect` — Menu does not close on selection. */
  export function Menu(props: {
    open: boolean;
    autoFocus?: boolean;
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
  }): JSX.Element;

  /** One option of a {@link SegmentedControl}. */
  export interface SegmentedControlOption {
    value: string;
    label: string;
    disabled?: boolean;
    title?: string;
  }

  /** Two-or-more equal-width segments with a sliding indicator, for switching a
   * card between a few modes — the official control official cards use where a
   * plugin would otherwise draw a switch. The owner renders one `role=tabpanel`
   * per option with id `<id>-<value>-panel` and `aria-labelledby` pointing at
   * `<id>-<value>`. */
  export function SegmentedControl(props: {
    id: string;
    value: string;
    options: readonly SegmentedControlOption[];
    onChange: (next: string) => void;
    label: string;
    disabled?: boolean;
    className?: string | undefined;
  }): JSX.Element;

  export const IconChevronDownOutlineRegular: (props: {
    readonly size?: number;
    readonly className?: string;
  }) => JSX.Element;
}
