# Deals (Chegirmali Takliflar) Workflow Requirements

This document outlines the required logic and data flow for the Deals/Promotions feature across the backend and the `web-user` application.

## 1. Backend Requirements

When a partner (`web-partner`) submits a new promotion via the partner dashboard, they only provide the following price and date information:
- `oldPriceSum`
- `newPriceSum`
- `discountPercent`
- `endsAt`

### API Workflow:
1. **Identify the Listing:** The backend must infer the specific listing (hotel, dacha, etc.) associated with the partner's token.
2. **Create CMS Offer (`CmsArticle` of type `offer`):** 
   The backend should automatically create a new Deal entry with `status: 'pending_review'`.
3. **Auto-Populate Metadata:** 
   The backend MUST automatically copy the following fields from the associated listing into the new Deal's metadata (so the admin doesn't have to enter them manually):
   - `title`: The name of the listing (e.g., "Hyatt Regency").
   - `slug`: The slug of the listing.
   - `cityName`: The city of the listing.
   - `imageUrl`: The cover image URL of the listing.
   - `listingType`: The type of the listing (e.g., `hotels`, `dachas`, `restaurants`, `sanatoriums`, `resorts`, `transport`).

> **Note to Backend:** The admin will see these auto-populated fields in `web-admin`. If they are empty, the admin will be forced to manually edit and add the image/slug before approving the deal.

## 2. Web-User Requirements

The `DealItem` interface in `apps/web-user/components/features/home/DealsSection.tsx` is currently missing the `listingType` field, and the URL logic has a hardcoded `hotels` path.

### Required Changes in `DealsSection.tsx`:

1. **Update `DealItem` Interface:**
   Add `listingType` to the interface.
   ```typescript
   export interface DealItem {
     id: string;
     slug: string;
     name: string;
     cityName: string;
     imageUrl: string;
     oldPriceSum: number;
     newPriceSum: number;
     discountPercent: number;
     endsAt: string;
     listingType?: string; // Add this field
   }
   ```

2. **Fix URL Hardcoding:**
   Currently, clicking a deal routes the user to `/${locale}/hotels/${deal.slug}`. This will cause a 404 error if the deal is for a dacha or restaurant.
   Update the `href` in `UniversalCard` to use the dynamic `listingType`:
   ```tsx
   <UniversalCard
     // ... other props
     href={`/${locale}/${deal.listingType || 'hotels'}/${deal.slug}`}
   />
   ```

> **Note to Web-User Developer:** Please ensure that the CMS API endpoint providing the deals includes `listingType` in the response so the routing works correctly for non-hotel partners.
