import { request } from '../client';

export type PartnerAccessStatus =
  | 'not_found'
  | 'new'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'submitted';

export interface PartnerApplicationDraft {
  companyName: string;
  type:
    | 'hotel'
    | 'bus'
    | 'hostel'
    | 'guesthouse'
    | 'motel'
    | 'dacha'
    | 'restaurant';
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  taxId: string;
  note?: string;
  /** `verifyPartnerRegistrationOtp()`dan olingan, bir martalik server-side
   * proof — backend buni majburiy talab qiladi (`PARTNER_PHONE_NOT_VERIFIED`
   * bilan rad etadi, agar yo'q/yaroqsiz/eskirgan/boshqa telefon uchun
   * bo'lsa). Client claim emas — backend proof'ni o'zi qayta tasdiqlaydi. */
  phoneVerificationToken: string;
}

export type PartnerAccessLookup = string | { phone?: string; email?: string };

export async function submitPartnerApplication(body: PartnerApplicationDraft) {
  const result = await request<{
    item: { id: string; status: PartnerAccessStatus };
  }>('/partners/requests', {
    method: 'POST',
    body,
  });
  return result;
}

export async function getPartnerAccessStatus(lookup: PartnerAccessLookup) {
  const searchParams =
    typeof lookup === 'string'
      ? { phone: lookup }
      : {
          phone: lookup.phone,
          email: lookup.email,
        };

  const result = await request<{
    found: boolean;
    status: PartnerAccessStatus;
    request?: {
      id: string;
      companyName: string;
      status: PartnerAccessStatus;
      type?: string;
    } | null;
  }>('/partners/requests', {
    searchParams,
  });
  return result;
}
