# Backend Tasks & Fixes Needed

This document outlines the tasks and fixes required from the backend team based on the recent QA audit and security review.

## 1. Security: OTP Bypass Vulnerability (SEC-1)
**File to update:** `apps/backend/src/auth/otp-store.ts` (and possibly `auth.service.ts`)

**Issue Description:** 
During the QA audit, it was discovered that the OTP verification flow has a potential infinite retry vulnerability. If a user exceeds the maximum number of failed attempts, the current logic throws an error but does NOT invalidate or delete the OTP challenge. This allows malicious actors to continue guessing the OTP.

**Required Action:**
- Modify the `verifyOtp` logic so that if the `attempts >= MAX_ATTEMPTS`, the OTP challenge is completely deleted from the store/database before throwing the error.
- Ensure that once an OTP is successfully verified, it is immediately deleted so it cannot be reused.

## 2. Configuration: Update CORS Origins (CORS-1)
**File to update:** `apps/backend/src/config/cors.ts` (or `main.ts`)

**Issue Description:**
The backend CORS configuration currently does not include all the necessary production domains for the Safaar project.

**Required Action:**
- Add `https://safaar.uz` and `https://www.safaar.uz` to the allowed origins.
- Add Vercel domains (e.g., `https://safaar-uz.vercel.app`, `https://safaar.vercel.app`).
- Consider using a regex pattern like `/^https:\/\/.*\.safaar\.uz$/` to allow all future subdomains automatically.
