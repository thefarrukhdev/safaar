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
  Copy,
  DoorOpen,
  ExternalLink,
  Eye,
  LogOut,
  MoreVertical,
  Phone,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { BookingStatus } from "@safaar/types";
import { Button } from "../../_components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../_components/ui/dropdown-menu";
import { ReservationStatusBadge } from "../../_components/domain/reservation-status-badge";
import { SourceBadge } from "../../_components/domain/source-badge";
import type { Bed, ReservationView } from "../../_lib/domain/types";
import { formatDate, formatMoney, formatPhone } from "../../_lib/utils/format";
import { cn } from "../../_lib/utils/cn";
import { todayIso } from "../../_lib/utils/date";

interface ReservationsTableProps {
  data: ReservationView[];
  beds: Bed[];
  unitLabel: string;
  isRestaurant: boolean;
  isBus: boolean;
  checkInLabel: string;
  checkOutLabel?: string;
  checkInActionLabel?: string;
  checkOutActionLabel?: string;
  onSelect: (reservation: ReservationView) => void;
  onConfirm: (reservation: ReservationView) => void;
  onReject: (reservation: ReservationView) => void;
  onCheckIn: (reservation: ReservationView) => void;
  onCheckOut?: (reservation: ReservationView) => void;
  onAssignRoom?: (reservation: ReservationView) => void;
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
      className="inline-flex items-center gap-1 font-semibold text-[var(--foreground)] hover:text-brand-600 transition-colors focus:outline-none"
    >
      <span>{label}</span>
      {isSorted === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5 text-brand-600" aria-hidden />
      ) : isSorted === "desc" ? (
        <ArrowDown className="h-3.5 w-3.5 text-brand-600" aria-hidden />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-40 hover:opacity-100" aria-hidden />
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
  checkInActionLabel,
  checkOutActionLabel,
  onSelect,
  onConfirm,
  onReject,
  onCheckIn,
  onCheckOut,
  onAssignRoom,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: ReservationsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "checkIn", desc: false },
  ]);

  const handleCopyPhone = async (phone: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(phone);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = phone;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success("Raqam nusxalandi");
    } catch {
      toast.error("Raqamni nusxalab bo'lmadi");
    }
  };

  const isAllSelected =
    data.length > 0 && selectedIds ? data.every((r) => selectedIds.has(r.id)) : false;
  const isSomeSelected = Boolean(
    selectedIds && data.some((r) => selectedIds.has(r.id)) && !isAllSelected,
  );

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
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={onToggleSelectAll}
                    aria-label="Barcha bronlarni tanlash"
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-700 cursor-pointer"
                  />
                </div>
              ),
              cell: ({ row }: { row: { original: ReservationView } }) => {
                const isSelected = selectedIds?.has(row.original.id) ?? false;
                return (
                  <div
                    className="flex items-center justify-center px-1"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(row.original.id)}
                      aria-label={`${row.original.id} bronni tanlash`}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-700 cursor-pointer"
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
        sortingFn: (rowA, rowB) =>
          (Number(rowA.original.id) || 0) - (Number(rowB.original.id) || 0) ||
          rowA.original.id.localeCompare(rowB.original.id),
        header: ({ column }) => <SortableHeader column={column} label="ID & Manba" />,
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs font-bold text-brand-700 dark:text-brand-300">
                #{r.id}
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
          const cleanPhone = r.guest.phone ? r.guest.phone.replace(/[^\d+]/g, "") : "";
          const telHref = cleanPhone ? `tel:${cleanPhone}` : undefined;
          return (
            <div className="flex flex-col min-w-[140px] gap-0.5">
              <span className="font-semibold text-sm truncate text-[var(--foreground)]">
                {r.guest.fullName}
              </span>
              <div
                className="flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                {telHref ? (
                  <a
                    href={telHref}
                    className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-brand-600 transition-colors"
                  >
                    <Phone className="h-3 w-3 text-brand-600" aria-hidden />
                    <span>{formatPhone(r.guest.phone)}</span>
                  </a>
                ) : (
                  <span className="text-xs text-[var(--muted-foreground)]">Raqamsiz</span>
                )}
                {r.guest.phone && (
                  <button
                    type="button"
                    onClick={(e) => handleCopyPhone(r.guest.phone, e)}
                    title="Raqamni nusxalash"
                    className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    <Copy className="h-3 w-3" aria-hidden />
                  </button>
                )}
              </div>
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
          const canAssign =
            r.status !== BookingStatus.CANCELLED &&
            r.status !== BookingStatus.COMPLETED &&
            Boolean(onAssignRoom);

          return (
            <div className="flex flex-col min-w-[120px]">
              <span className="font-medium text-xs text-[var(--foreground)]">{r.roomTypeName}</span>
              {assignedUnit ? (
                <span className="text-xs text-[var(--muted-foreground)]">{assignedUnit}</span>
              ) : canAssign ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssignRoom?.(r);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400 mt-0.5 text-left"
                >
                  <DoorOpen className="h-3 w-3" aria-hidden />
                  <span>Biriktirish</span>
                </button>
              ) : (
                <span className="italic text-xs text-[var(--muted-foreground)]">Belgilanmagan</span>
              )}
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
                <span className="font-medium text-[var(--foreground)]">{formatDate(r.checkIn)}</span>
                <span className="text-[var(--muted-foreground)]">{r.slotTime}</span>
              </div>
            );
          }
          return (
            <div className="flex flex-col text-xs min-w-[110px]">
              <span className="font-medium text-[var(--foreground)]">
                {formatDate(r.checkIn)} → {formatDate(r.checkOut)}
              </span>
              <span className="text-[var(--muted-foreground)]">
                {r.nights} {isBus ? "kun" : isRest ? "tashrif" : "kecha"}
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
            <div className="flex flex-col gap-0.5 min-w-[110px]">
              <span className="font-semibold text-xs text-[var(--foreground)] tabular-nums">
                {formatMoney(r.totalPrice)}
              </span>
              {isPaid ? (
                <span className="inline-flex items-center text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  To'liq to'langan
                </span>
              ) : (
                <span className="inline-flex items-center text-[11px] font-medium text-amber-600 dark:text-amber-400 tabular-nums">
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
          const today = todayIso();
          const isPastCheckIn = today > r.checkIn.slice(0, 10);
          const isPastCheckOut = today > r.checkOut.slice(0, 10);
          const canConfirm =
            (r.status === BookingStatus.PENDING ||
              r.status === BookingStatus.AWAITING_PARTNER_CONFIRMATION) &&
            !isPastCheckIn;
          const canCheckIn = r.status === BookingStatus.CONFIRMED && !isPastCheckOut;
          const canCheckOut = r.status === "IN_HOUSE";
          const canAssignRoom =
            r.status !== BookingStatus.CANCELLED &&
            r.status !== BookingStatus.COMPLETED;
          const cleanPhone = r.guest.phone ? r.guest.phone.replace(/[^\d+]/g, "") : "";
          const telHref = cleanPhone ? `tel:${cleanPhone}` : undefined;

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
                    className="h-8 px-2.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                    title="Rad etish"
                    onClick={() => onReject(r)}
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden xl:inline ml-1">Rad</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 px-2.5 text-xs bg-brand-600 hover:bg-brand-700 text-white"
                    title="Tasdiqlash"
                    onClick={() => onConfirm(r)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden xl:inline ml-1">Tasdiq</span>
                  </Button>
                </>
              )}
              {canCheckIn && (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  title={checkInActionLabel ?? checkInLabel}
                  onClick={() => onCheckIn(r)}
                >
                  <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden xl:inline ml-1">{checkInActionLabel ?? checkInLabel}</span>
                </Button>
              )}
              {canCheckOut && onCheckOut && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 px-2.5 text-xs"
                  title={checkOutActionLabel ?? checkOutLabel ?? "Chiqish"}
                  onClick={() => onCheckOut(r)}
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden xl:inline ml-1">{checkOutActionLabel ?? checkOutLabel ?? "Chiqish"}</span>
                </Button>
              )}

              {/* Quick View Button */}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                title="Tezkor ko'rish"
                onClick={() => onSelect(r)}
              >
                <Eye className="h-4 w-4" aria-hidden />
              </Button>

              {/* 3-Dot Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    title="Qo'shimcha amallar"
                  >
                    <MoreVertical className="h-4 w-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom" className="w-56">
                  <DropdownMenuLabel>Bron #{r.id}</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onSelect(r)}>
                    <Eye className="h-4 w-4 mr-2 text-brand-600" />
                    <span>Tezkor ko'rish</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <Link href={`/reservations/${r.id}`}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      <span>Batafsil sahifa</span>
                    </Link>
                  </DropdownMenuItem>

                  {r.guest.phone && (
                    <>
                      <DropdownMenuItem
                        onClick={(e) => handleCopyPhone(r.guest.phone, e)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        <span>Raqamni nusxalash</span>
                      </DropdownMenuItem>

                      {telHref && (
                        <DropdownMenuItem asChild>
                          <a href={telHref}>
                            <Phone className="h-4 w-4 mr-2 text-emerald-600" />
                            <span>Qo'ng'iroq qilish</span>
                          </a>
                        </DropdownMenuItem>
                      )}
                    </>
                  )}

                  <DropdownMenuSeparator />

                  {canAssignRoom && onAssignRoom && (
                    <DropdownMenuItem onClick={() => onAssignRoom(r)}>
                      <DoorOpen className="h-4 w-4 mr-2 text-brand-600" />
                      <span>{r.roomNumber ? `${unitLabel}ni almashtirish` : `${unitLabel}ni biriktirish`}</span>
                    </DropdownMenuItem>
                  )}

                  {canConfirm && (
                    <>
                      <DropdownMenuItem onClick={() => onConfirm(r)}>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
                        <span>Tasdiqlash</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onReject(r)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <XCircle className="h-4 w-4 mr-2 text-red-600" />
                        <span>Rad etish</span>
                      </DropdownMenuItem>
                    </>
                  )}

                  {canCheckIn && (
                    <DropdownMenuItem onClick={() => onCheckIn(r)}>
                      <CalendarCheck className="h-4 w-4 mr-2 text-emerald-600" />
                      <span>{checkInLabel}</span>
                    </DropdownMenuItem>
                  )}

                  {canCheckOut && onCheckOut && (
                    <DropdownMenuItem onClick={() => onCheckOut(r)}>
                      <LogOut className="h-4 w-4 mr-2 text-blue-600" />
                      <span>{checkOutLabel ?? "Chiqish"}</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ];
  }, [
    beds,
    checkInLabel,
    checkOutLabel,
    checkInActionLabel,
    checkOutActionLabel,
    isBus,
    isRest,
    onCheckIn,
    onCheckOut,
    onConfirm,
    onReject,
    onSelect,
    onAssignRoom,
    unitLabel,
    selectedIds,
    onToggleSelect,
    onToggleSelectAll,
    isAllSelected,
    isSomeSelected,
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
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs">
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
                  if (e.target !== e.currentTarget) return;
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
