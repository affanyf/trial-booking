// Shared Tailwind class strings so the 3 minimal-UI pages look consistent
// without each page redeclaring the same styling. Every color pairs a
// light-mode shade with a dark:-mode shade so text never goes low-contrast
// against the OS theme (globals.css already flips the page background via
// prefers-color-scheme, independent of these Tailwind classes).
export const button =
  "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer";
export const select =
  "rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100";
export const label = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
export const link =
  "text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300";
export const card =
  "rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm";
export const heading = "font-semibold text-gray-800 dark:text-gray-100";
export const muted = "text-sm text-gray-500 dark:text-gray-400";
export const bodyText = "text-gray-700 dark:text-gray-200";
