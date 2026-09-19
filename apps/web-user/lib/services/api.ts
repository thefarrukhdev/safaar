import { api as baseApi, apiConfig } from "@safaar/api-client";
import { config } from "../config/config";
import { paymentsService } from "./payments/payments";
import { refundsService } from "./refunds/refunds";

// Configure base URL at initialization
apiConfig.setBaseUrl(config.apiUrl);

export const api = {
  ...baseApi,
  payments: paymentsService,
  refunds: refundsService,
};

export { ApiRequestError } from "@safaar/api-client";

