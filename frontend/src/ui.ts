/** Shared Tailwind class snippets */
export const field =
  "h-[42px] w-full rounded-[10px] border border-gray-300 bg-white px-3.5 text-gray-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-blue-100";

export const btnPrimary =
  "inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] bg-primary px-4 font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60";

export const btnGhost =
  "inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] border border-gray-300 bg-white px-4 text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45";

export const iconBtn =
  "relative grid h-10 w-10 place-items-center rounded-[10px] border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50";

export const card =
  "rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_rgba(16,24,40,0.04)]";

export function rolePill(code: string): string {
  if (code === "admin") return "inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700";
  if (code === "manager") return "inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700";
  return "inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700";
}

export function statusClass(active: boolean): string {
  return active ? "bg-green-600" : "bg-red-600";
}
