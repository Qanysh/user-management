import type { SelectHTMLAttributes } from "react";
import { HiOutlineChevronDown } from "react-icons/hi2";

import { field } from "../ui";

const selectClass = `${field} cursor-pointer appearance-none bg-none pr-10`;

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement>;

export function SelectField({ className = "", children, ...props }: SelectFieldProps) {
  return (
    <div className="relative min-w-0">
      <select className={`${selectClass} ${className}`} {...props}>
        {children}
      </select>
      <HiOutlineChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        aria-hidden
      />
    </div>
  );
}
