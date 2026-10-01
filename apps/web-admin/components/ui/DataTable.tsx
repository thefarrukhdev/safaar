"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export default function DataTable<T>({
  columns,
  data,
  keyField,
  emptyMessage = "Ma'lumot topilmadi",
  onRowClick,
  className,
  isLoading,
  isError,
  onRetry,
}: DataTableProps<T>) {
  return (
    <div className={cn("overflow-x-auto overflow-y-visible rounded-xl border border-[var(--border)] bg-white", className)}>
      <table className="w-full text-sm whitespace-nowrap">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-tertiary)]">
            {columns.map((col, index) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider",
                  index === 0 && "rounded-tl-xl",
                  index === columns.length - 1 && "rounded-tr-xl",
                  col.className
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-light)]">
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-[var(--text-muted)]">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"></div>
                  Yuklanmoqda...
                </div>
              </td>
            </tr>
          ) : isError ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-red-500">
                <div className="flex flex-col items-center gap-2">
                  <span>Ma'lumotlarni yuklashda xatolik yuz berdi.</span>
                  {onRetry && (
                    <button onClick={onRetry} className="text-sm border border-red-200 rounded px-3 py-1 hover:bg-red-50 transition-colors">
                      Qayta urinish
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-[var(--text-muted)]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={String(row[keyField])}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "transition-colors duration-100",
                  onRowClick
                    ? "hover:bg-[var(--primary-50)] cursor-pointer"
                    : "hover:bg-[var(--bg-tertiary)]"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-4 py-3 text-[var(--text-primary)]",
                      col.className
                    )}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export type { Column };
