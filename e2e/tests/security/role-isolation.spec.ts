import { test, expect, request } from '@playwright/test';

// Qoidalar bo'yicha QA_E2E_ prefix ishlatilishi shart
const TEST_PHONE = '+998909990001';
const TEST_PASSWORD = 'QA_E2E_Password123!';

test.describe('Role Isolation & Security Audit', () => {
  let userToken = '';
  let adminToken = '';

  test.beforeAll(async () => {
    // 1. Admin login (from known seeds)
    const adminContext = await request.newContext({ baseURL: 'https://api.safaar.uz/v1' });
    const adminLogin = await adminContext.post('/auth/admin/login', {
      data: { email: 'admin@safaar.uz', password: 'Admin12345!' }
    });
    const adminData = await adminLogin.json();
    adminToken = adminData.data?.accessToken;
    expect(adminToken).toBeTruthy();

    // 2. User OTP & Login
    const userContext = await request.newContext({ baseURL: 'https://api.safaar.uz/v1' });
    const otpRes = await userContext.post('/auth/user/send-otp', {
      data: { phone: TEST_PHONE }
    });
    const otpData = await otpRes.json();
    const devCode = otpData.data?.dev_code || '111111'; // Assuming demo auth is enabled

    const verifyRes = await userContext.post('/auth/user/verify-otp', {
      data: { phone: TEST_PHONE, code: devCode }
    });
    const verifyData = await verifyRes.json();
    userToken = verifyData.data?.accessToken;

    if (!userToken) {
        // Must register
        const regRes = await userContext.post('/auth/user/register', {
            data: { phone: TEST_PHONE, code: devCode, firstName: 'QA_E2E_User', lastName: 'Test', password: TEST_PASSWORD }
        });
        const regData = await regRes.json();
        userToken = regData.data?.accessToken;
    }
  });

  test('USER admin endpointlariga kira olmasligi kerak (Point 3)', async ({ request }) => {
    // Try to get admin stats using user token
    const res = await request.get('https://api.safaar.uz/v1/admin/dashboard/stats', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    expect(res.status()).toBe(403);
  });

  test('USER partner endpointlariga kira olmasligi kerak', async ({ request }) => {
    const res = await request.get('https://api.safaar.uz/v1/partners/dashboard/stats', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    expect(res.status()).toBe(403);
  });
});
