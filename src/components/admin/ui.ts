/** Shared Tailwind class strings of the admin page (Obsidian Kinetic tokens). */

export const card = "rounded-xl border border-outline-variant bg-surface-container-low p-4 sm:p-5";
export const cardTitle = "mb-3 font-mono text-label-mono-sm uppercase text-on-surface-variant";

const button =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
export const primaryButton = `${button} bg-primary px-4 py-2 text-body-md text-on-primary hover:bg-primary-fixed`;
export const ghostButton = `${button} border border-outline-variant px-3 py-1.5 text-body-md text-on-surface hover:bg-surface-container-high`;
export const smallGhostButton = `${button} border border-outline-variant px-2.5 py-1 text-label-mono-sm text-on-surface hover:bg-surface-container-high`;
export const dangerButton = `${button} border border-error/50 px-2.5 py-1 text-label-mono-sm text-error hover:bg-error/10`;
export const dangerConfirmButton = `${button} border border-error bg-error px-2.5 py-1 text-label-mono-sm text-on-error`;

export const fieldLabel = "mb-1 block text-label-mono-sm text-on-surface-variant";
export const input =
  "w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface placeholder:text-outline [color-scheme:dark]";
export const hint = "text-label-mono-sm text-outline";
export const errorText = "text-body-md text-error";

export const pill = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-label-mono-sm";
