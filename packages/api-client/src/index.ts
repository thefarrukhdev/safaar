import { authService } from "./services/auth";
import { bookingsService } from "./services/bookings";
import { catalogService } from "./services/catalog";
import { cmsService } from "./services/cms";
import { currencyService } from "./services/currency";
import { hotelsService } from "./services/hotels";
import { promosService } from "./services/promos";
import { reviewsService } from "./services/reviews";
import { supportService } from "./services/support";
import { usersService } from "./services/users";

export const api = {
  auth: authService,
  bookings: bookingsService,
  catalog: catalogService,
  cms: cmsService,
  currency: currencyService,
  hotels: hotelsService,
  promos: promosService,
  reviews: reviewsService,
  support: supportService,
  users: usersService,
};

export { apiConfig, ApiRequestError } from "./client";
export * from "./types";
export * from "./adapters";
export { formatSum, formatTiyin, tiyinToSum } from "./money";

export * from "./services/auth";
export * from "./services/bookings";
export * from "./services/catalog";
export * from "./services/cms";
export * from "./services/currency";
export * from "./services/hotels";
export * from "./services/promos";
export * from "./services/reviews";
export * from "./services/support";
export * from "./services/users";
