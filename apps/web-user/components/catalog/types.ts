export interface AttractionItem {
  id: string;
  name: string;
  cityName: string;
  categoryKey: "historical" | "unesco" | "nature";
  categoryDefault: string;
  description: string;
  rating: number;
  imageUrl: string;
  bestTimeToVisit: string;
  latitude?: number;
  longitude?: number;
}

export interface RestaurantItem {
  id: string;
  name: string;
  cityName: string;
  address: string;
  cuisine: string;
  rating: number;
  reviewsCount: number;
  averageCheckSum: number;
  workingHours: string;
  imageUrl: string;
  phone: string;
}

export interface TransportItem {
  id: string;
  name: string;
  cityName: string;
  categoryKey: "rent" | "transfer" | "vip";
  categoryDefault: string;
  seats: number;
  hasDriver: boolean;
  fuelType?: string;
  transmission?: string;
  pricePerDaySum: number;
  rating: number;
  imageUrl: string;
  phone: string;
}
