"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type Column,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarCheck,
  CheckCircle2,
  Eye,
  LogOut,
  XCircle,
} from "lucide-react";
import { BookingStatus } from "@safaar/types";
import { Button } from "../../_components/ui/button";
import { ReservationStatusBadge } from "../../_components/domain/reservation-status-badge";
import { SourceBadge } from "../../_components/domain/source-badge";
import type { Bed, ReservationView } from "../../_lib/domain/types";
import { formatDate, formatMoney, formatPhone } from "../../_lib/utils/format";
import { cn } from "../../_lib/utils/cn";

interface ReservationsTableProps {
  data: ReservationView[];
  beds: Bed[];
  unitLabel: string;
  isRestaurant: boolean;
  isBus: boolean;
  checkInLabel: string;
  checkOutLabel?: string;
  onSelect: (reservation: ReservationView) => void;
  onConfirm: (reservation: ReservationView) => void;
  onReject: (reservation: ReservationView) => void;
  onCheckIn: (reservation: ReservationView) => void;
  onCheckOut?: (reservation: ReservationView) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
}

interface SortableHeaderProps {
  column: Column<ReservationView, unknown>;
  label: string;
}

function SortableHeader({ column, label }: SortableHeaderProps) {
  const isSorted = column.getIsSorted();
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(isSorted === "asc")}
      aria-label={`${label} bo'yicha saralash`}
      className="inline-flex items-center gap-1 font-semibold text-[var(--foreground)] hover:text-brand-600 transition-colors"
    >
      {label}
      {isSorted === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5 text-brand-600" aria-hidden />
      ) : isSorted === "desc" ? (
        <ArrowDown className="h-3.5 w-3.5 text-brand-600" aria-hidden />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />
      )}
    </button>
  );
}

export function ReservationsTable({
  data,
  beds,
  unitLabel,
  isRestaurant: isRest,
  isBus,
  checkInLabel,
  checkOutLabel,
  onSelect,
  onConfirm,
  onReject,
  onCheckIn,
  onCheckOut,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: ReservationsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "checkIn", desc: false },
  ]);

  const columns = useMemo<ColumnDef<ReservationView>[]>(() => {
    return [
      ...(onToggleSelect
        ? [
            {
              id: "select",
              header: () => (
                <div className="flex items-center justify-center px-1">
                  <input
                    type="checkbox"
                    checked={data.length > 0 && selectedIds?.size === data.length}
                    onChange={onToggleSelectAll}
                    aria-label="Barcha bronlarni tanlash"
                    className="h-4 w-4 rounded border-slate-300 dark:border-zinc-700 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                </div>
              ),
              cell: ({ row }: { row: { original: ReservationView } }) => {
                const isSelected = selectedIds?.has(row.original.id) ?? false;
                return (
                  <div
                    className="flex items-center justify-center px-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(row.original.id)}
                      aria-label={`${row.original.id} bronni tanlash`}
                      className="h-4 w-4 rounded border-slate-300 dark:border-zinc-700 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                  </div>
                );
              },
            } as ColumnDef<ReservationView>,
          ]
        : []),
      {
        id: "id",
        accessorKey: "id",
        header: ({ column }) => <SortableHeader column={column} label="ID & Manba" />,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">
                {r.id}
              </span>
              <SourceBadge source={r.source} />
            </div>
          );
        },
      },
      {
        id: "guest",
        accessorFn: (row) => row.guest.fullName,
        header: ({ column }) => <SortableHeader column={column} label="Mijoz" />,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex flex-col min-w-[140px]">
              <span className="font-semibold text-sm truncate">{r.guest.fullName}</span>
              <span className="text-xs text-[var(--muted-foreground)]">
                {formatPhone(r.guest.phone)}
              </span>
            </div>
          );
        },
      },
      {
        id: "unit",
        accessorFn: (row) => `${row.roomTypeName} ${row.roomNumber ?? ""}`,
        header: ({ column }) => (
          <SortableHeader
            column={column}
            label={unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1)}
          />
        ),
        cell: ({ row }) => {
          const r = row.original;
          const assignedBed = r.bedId ? beds.find((b) => b.id === r.bedId) : undefined;
          const assignedUnit = [r.roomNumber, assignedBed?.label].filter(Boolean).join(" · ");
          return (
            <div className="flex flex-col min-w-[120px]">
              <span className="font-medium text-xs">{r.roomTypeName}</span>
              <span className="text-xs text-[var(--muted-foreground)]">
                {assignedUnit || <span className="italic text-zinc-400">Belgilanmagan</span>}
              </span>
            </div>
          );
        },
      },
      {
        id: "checkIn",
        accessorKey: "checkIn",
        sortingFn: (rowA, rowB) => {
          const tA = new Date(rowA.original.checkIn).getTime() || 0;
          const tB = new Date(rowB.original.checkIn).getTime() || 0;
          return tA - tB;
        },
        header: ({ column }) => (
          <SortableHeader
            column={column}
            label={isBus ? "Ijara muddati" : isRest ? "Sana & Vaqt" : "Sana"}
          />
        ),
        cell: ({ row }) => {
          const r = row.original;
          if (isRest && r.slotTime) {
            return (
              <div className="flex flex-col text-xs min-w-[110px]">
                <span className="font-medium">{formatDate(r.checkIn)}</span>
                <span className="text-[var(--muted-foreground)]">{r.slotTime}</span>
              </div>
            );
          }
          return (
            <div className="flex flex-col text-xs min-w-[110px]">
              <span className="font-medium">
                {formatDate(r.checkIn)} → {formatDate(r.checkOut)}
              </span>
              <span className="text-[var(--muted-foreground)]">
                {r.nights} {isBus ? "kun" : "kecha"}
              </span>
            </div>
          );
        },
      },
      {
        id: "payment",
        accessorKey: "totalPrice",
        header: ({ column }) => <SortableHeader column={column} label="Summa & To'lov" />,
        cell: ({ row }) => {
          const r = row.original;
          const isPaid = r.paidAmount >= r.totalPrice && r.totalPrice > 0;
          const balance = Math.max(0, r.totalPrice - r.paidAmount);
          return (
            <div className="flex flex-col gap-1 min-w-[110px]">
              <span className="font-semibold text-xs">{formatMoney(r.totalPrice)}</span>
              {isPaid ? (
                <span className="inline-flex items-center text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  To'langan
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] font-medium text-amber-600 dark:text-amber-400">
                  Qoldiq: {formatMoney(balance)}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => <SortableHeader column={column} label="Status" />,
        cell: ({ row }) => {
          return <ReservationStatusBadge status={row.original.status} />;
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Amallar</span>,
        cell: ({ row }) => {
          const r = row.original;
          const today = new Date().toISOString().split("T")[0];
          const isPastCheckIn = today > r.checkIn.slice(0, 10);
          const isPastCheckOut = today > r.checkOut.slice(0, 10);
          const canConfirm =
            (r.status === BookingStatus.PENDING ||
              r.status === BookingStatus.AWAITING_PARTNER_CONFIRMATION) &&
            !isPastCheckIn;
          const canCheckIn = r.status === BookingStatus.CONFIRMED && !isPastCheckOut;
          const canCheckOut = r.status === "IN_HOUSE";

          return (
            <div
              className="flex items-center justify-end gap-1.5"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {canConfirm && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    title="Rad etish"
                    onClick={() => onReject(r)}
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden xl:inline">Rad</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    title="Tasdiqlash"
                    onClick={() => onConfirm(r)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden xl:inline">Tasdiq</span>
                  </Button>
                </>
              )}
              {canCheckIn && (
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  title={checkInLabel}
                  onClick={() => onCheckIn(r)}
                >
                  <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden xl:inline">{checkInLabel}</span>
                </Button>
              )}
              {canCheckOut && onCheckOut && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 text-[11px]"
                  title={checkOutLabel ?? "Chiqish"}
                  onClick={() => onCheckOut(r)}
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden xl:inline">{checkOutLabel ?? "Chiqish"}</span>
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                title="Tezkor ko'rish"
                onClick={() => onSelect(r)}
              >
                <Eye className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          );
        },
      },
    ];
  }, [
    beds,
    checkInLabel,
    checkOutLabel,
    isBus,
    isRest,
    onCheckIn,
    onCheckOut,
    onConfirm,
    onReject,
    onSelect,
    unitLabel,
    selectedIds,
    onToggleSelect,
    onToggleSelectAll,
    data,
  ]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse min-w-[760px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--muted-foreground)]"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      header.column.getIsSorted() === "asc"
                        ? "ascending"
                        : header.column.getIsSorted() === "desc"
                          ? "descending"
                          : "none"
                    }
                    className="py-3 px-4 font-semibold whitespace-nowrap"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onSelect(row.original)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(row.original);
                  }
                }}
                className={cn(
                  "cursor-pointer transition-colors duration-150",
                  "hover:bg-[var(--surface-hover)] focus:bg-[var(--surface-hover)] focus:outline-none",
                  selectedIds?.has(row.original.id) &&
                    "bg-brand-50/70 dark:bg-brand-950/30",
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="py-3 px-4 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
