'use client';

import { create } from 'zustand';
import { BookingStatus } from '@safaar/types';
import {
  RoomStatus,
  type Bed,
  type FrontDeskStats,
  type GuestProfile,
  type ReservationView,
  type Room,
  type RoomType,
} from '../_lib/domain/types';
import {
  CancellationPolicy,
  ListingStatus,
  PhotoCategory,
  type Listing,
  type ExtraFee,
  type NearbyPlace,
} from '../_lib/domain/listing';

const emptyListing: Listing = {
  name: '',
  shortDescription: '',
  fullDescription: '',
  status: ListingStatus.DRAFT,
  address: '',
  city: '',
  stars: 0,
  checkInTime: '',
  checkOutTime: '',
  amenities: [],
  photos: [],
  nearby: [],
  cancellationPolicy: CancellationPolicy.MODERATE,
  smokingAllowed: false,
  petsAllowed: false,
  childrenAllowed: true,
  extraFees: [],
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isRevenueBooking(reservation: ReservationView) {
  return (
    reservation.status !== BookingStatus.CANCELLED &&
    reservation.status !== BookingStatus.EXPIRED
  );
}

export interface WalkInDraft {
  fullName: string;
  phone: string;
  roomTypeId: string;
  roomNumber?: string;
  /** Faqat hostel: oldindan tanlangan yotoq. */
  bedId?: string;
  /** Faqat restoran: bron vaqt-sloti ("HH:MM"). */
  slotTime?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  nights: number;
  totalPrice: number;
}

export interface RoomTypeDraft {
  name: string;
  description?: string;
  imageUrl?: string;
  bedType?: string;
  sizeSqm?: number;
  basePrice: number;
  capacity: number;
  amenities: string[];
}

export interface RoomDraft {
  number: string;
  floor: number;
  roomTypeId: string;
  status?: RoomStatus;
  isListed?: boolean;
  nightlyPrice?: number;
}

export interface BedDraft {
  roomId: string;
  label: string;
  status?: RoomStatus;
  isListed?: boolean;
  nightlyPrice?: number;
}

export interface BulkRoomsDraft {
  floor: number;
  /** Boshlanish raqami, masalan 101 */
  startNumber: number;
  count: number;
  roomTypeId: string;
}

export interface ListingGeneralDraft {
  name: string;
  shortDescription: string;
  fullDescription: string;
  stars: number;
}

export interface ListingRulesDraft {
  checkInTime: string;
  checkOutTime: string;
  cancellationPolicy: CancellationPolicy;
  smokingAllowed: boolean;
  petsAllowed: boolean;
  childrenAllowed: boolean;
  extraFees?: ExtraFee[];
}

export interface PhotoDraft {
  url: string;
  caption?: string;
  category: PhotoCategory;
}

export interface ListingLocationDraft {
  cityId?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  nearbyPlaces?: NearbyPlace[];
}

interface DataState {
  reservations: ReservationView[];
  rooms: Room[];
  roomTypes: RoomType[];
  beds: Bed[];
  guests: GuestProfile[];
  listing: Listing;

  setListing: (listing: Listing) => void;
  setRooms: (rooms: Room[]) => void;
  setRoomTypes: (roomTypes: RoomType[]) => void;
  setBeds: (beds: Bed[]) => void;
  setReservations: (reservations: ReservationView[]) => void;

  confirmReservation: (id: string) => void;
  rejectReservation: (id: string) => void;
  checkIn: (id: string) => void;
  checkOut: (id: string) => void;
  assignRoom: (reservationId: string, roomNumber: string) => void;

  getStats: () => FrontDeskStats;
  isListingComplete: () => {
    complete: boolean;
    missing: string[];
  };
}

export const useDataStore = create<DataState>((set, get) => ({
  reservations: [],
  rooms: [],
  roomTypes: [],
  beds: [],
  guests: [],
  listing: emptyListing,

  setListing: (listing) => set({ listing }),
  setRooms: (rooms) => set({ rooms }),
  setRoomTypes: (roomTypes) => set({ roomTypes }),
  setBeds: (beds) => set({ beds }),
  setReservations: (reservations) => set({ reservations }),

  confirmReservation: (id) =>
    set((state) => ({
      reservations: state.reservations.map((reservation) =>
        reservation.id === id
          ? { ...reservation, status: BookingStatus.CONFIRMED }
          : reservation,
      ),
    })),

  rejectReservation: (id) =>
    set((state) => ({
      reservations: state.reservations.map((reservation) =>
        reservation.id === id
          ? { ...reservation, status: BookingStatus.CANCELLED }
          : reservation,
      ),
    })),

  checkIn: (id) =>
    set((state) => {
      const reservation = state.reservations.find((item) => item.id === id);
      const reservations = state.reservations.map((item) =>
        item.id === id ? { ...item, status: 'IN_HOUSE' as const } : item,
      );
      if (!reservation) return { reservations };

      if (reservation.bedId) {
        return {
          reservations,
          beds: state.beds.map((bed) =>
            bed.id === reservation.bedId
              ? {
                  ...bed,
                  status: RoomStatus.OCCUPIED,
                  occupant: {
                    guestName: reservation.guest.fullName,
                    reservationId: reservation.id,
                    checkOut: reservation.checkOut,
                  },
                }
              : bed,
          ),
        };
      }

      return {
        reservations,
        rooms: reservation.roomNumber
          ? state.rooms.map((room) =>
              room.number === reservation.roomNumber
                ? {
                    ...room,
                    status: RoomStatus.OCCUPIED,
                    occupant: {
                      guestName: reservation.guest.fullName,
                      reservationId: reservation.id,
                      checkOut: reservation.checkOut,
                    },
                  }
                : room,
            )
          : state.rooms,
      };
    }),

  checkOut: (id) =>
    set((state) => {
      const reservation = state.reservations.find((item) => item.id === id);
      const reservations = state.reservations.map((item) =>
        item.id === id ? { ...item, status: BookingStatus.COMPLETED } : item,
      );
      if (!reservation) return { reservations };

      if (reservation.bedId) {
        return {
          reservations,
          beds: state.beds.map((bed) =>
            bed.id === reservation.bedId
              ? { ...bed, status: RoomStatus.VACANT_DIRTY, occupant: undefined }
              : bed,
          ),
        };
      }

      return {
        reservations,
        rooms: reservation.roomNumber
          ? state.rooms.map((room) =>
              room.number === reservation.roomNumber
                ? {
                    ...room,
                    status: RoomStatus.VACANT_DIRTY,
                    occupant: undefined,
                  }
                : room,
            )
          : state.rooms,
      };
    }),

  assignRoom: (reservationId, roomNumber) =>
    set((state) => ({
      reservations: state.reservations.map((reservation) =>
        reservation.id === reservationId
          ? { ...reservation, roomNumber }
          : reservation,
      ),
    })),

  isListingComplete: () => {
    const listing = get().listing;
    const missing: string[] = [];
    if (listing.name.trim().length < 3) missing.push('Nomi juda qisqa');
    if (listing.shortDescription.trim().length < 20) {
      missing.push("Qisqa tavsif to'ldirilmagan (min 20 belgi)");
    }
    if (listing.fullDescription.trim().length < 100) {
      missing.push('Batafsil tavsif juda qisqa (min 100 belgi)');
    }
    if (listing.photos.length < 3) missing.push('Kamida 3 ta rasm kerak');
    if (listing.amenities.length < 3)
      missing.push('Kamida 3 ta qulaylik belgilash');
    if (!listing.address.trim()) missing.push('Manzil kiritilmagan');
    return { complete: missing.length === 0, missing };
  },

  getStats: () => {
    const { reservations, rooms, beds } = get();
    const today = todayIso();
    const currentMonth = today.slice(0, 7);
    const occupied =
      beds.length > 0
        ? beds.filter((bed) => bed.status === RoomStatus.OCCUPIED).length
        : rooms.filter((room) => room.status === RoomStatus.OCCUPIED).length;
    const total = beds.length > 0 ? beds.length : rooms.length;
    const arrivals = reservations.filter(
      (reservation) =>
        reservation.checkIn === today &&
        reservation.status === BookingStatus.CONFIRMED,
    ).length;
    const departures = reservations.filter(
      (reservation) =>
        reservation.checkOut === today && reservation.status === 'IN_HOUSE',
    ).length;
    const pending = reservations.filter(
      (reservation) => reservation.status === BookingStatus.PENDING,
    ).length;
    const monthRevenue = reservations
      .filter(
        (reservation) =>
          reservation.checkIn.startsWith(currentMonth) &&
          isRevenueBooking(reservation),
      )
      .reduce((sum, reservation) => sum + reservation.totalPrice, 0);

    return {
      occupancyPercent: total ? Math.round((occupied / total) * 100) : 0,
      totalRooms: total,
      occupiedRooms: occupied,
      arrivalsToday: arrivals,
      departuresToday: departures,
      pendingReservations: pending,
      monthRevenue,
    };
  },
}));
