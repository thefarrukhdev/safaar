# safaar Postman Tests

Import these two files into Postman:

- `safaar_API.postman_collection.json`
- `safaar_Local.postman_environment.json`

Run order for local testing:

1. Start backend: `pnpm run dev:backend`
2. Select the `safaar Local` environment.
3. Run `POST /auth/user/send-otp`.
4. Run `POST /auth/user/verify-otp`; it stores `userAccessToken`.
5. Run `POST /auth/partner/login`; it stores `partnerAccessToken`.
6. Run `POST /auth/admin/login`; it stores `adminAccessToken` when demo 2FA is not enabled.
7. Run partner `POST /partner/api-keys`; it stores `partnerApiKey`.
8. Run the remaining folders.

Every request has Postman tests that check:

- response is not 5xx;
- response time is below 10 seconds;
- JSON response shape when a body exists;
- important auth/create requests save IDs and tokens into environment variables.

Webhook requests generate `x-safaar-mock-signature` in a pre-request script.
If your backend uses another `PAYMENT_WEBHOOK_SECRET`, update
`paymentWebhookSecret` in the Postman environment.

Regenerate after controller changes:

```bash
node apps/backend/postman/generate-collection.mjs
```
