# Direct Card Payment & SMS Verification - Backend Task

## Context
The user requested a **Direct Card Entry & SMS Verification** flow for checkout instead of redirecting the user to Click/Payme full-page checkouts. 

We have implemented the UI mock in the frontend (`CheckoutForm.tsx`). When the user selects Uzcard, Humo, Visa, or Mastercard, they enter their Card Number and Expiry Date directly on the checkout form. Upon submitting, a mock SMS verification modal appears. When they enter the code, it creates the booking and skips the "pending" redirect, marking it as a successful payment.

## Required API Changes (Backend)

The backend currently returns a `paymentUrl` for redirect flows (Click, Payme, Uzum). To support direct card payment, the backend needs to implement endpoints that probably integrate with **Payme Subscribe API** or similar tokenization gateways.

### 1. Send SMS Code (Initiate Card Payment)
`POST /v1/payments/card/send-otp`
- **Request Body**:
  ```json
  {
    "bookingId": "uuid",
    "cardNumber": "1234567812345678",
    "expiryDate": "12/25"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "sessionId": "payme-session-uuid-123",
    "phoneMask": "+998 ** *** ** 78"
  }
  ```
  *(The session ID is needed for the verification step).*

### 2. Verify SMS Code (Confirm Payment)
`POST /v1/payments/card/verify-otp`
- **Request Body**:
  ```json
  {
    "bookingId": "uuid",
    "sessionId": "payme-session-uuid-123",
    "smsCode": "123456"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "transactionId": "...",
    "status": "PAID"
  }
  ```

## Integration Plan
Once the backend endpoints are ready, the frontend developer will update `createBookingAction` (or a separate payment action) to call these APIs instead of the current `setTimeout` UI mock.

**Note on Database/Entities:**
You may need to add a table or fields to store partial payment sessions (`sessionId`) before the payment is fully authorized.
