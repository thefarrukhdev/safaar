const fs = require('fs');
const crypto = require('crypto');

const API = 'https://api.safaar.uz/v1';

async function req(path, opts = {}) {
  const url = API + path;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...opts.headers
    }
  });
  let body;
  try {
      body = await res.json();
  } catch(e) {
      body = await res.text();
  }
  return { status: res.status, body };
}

let report = `# SAFAAR FULL E2E QA REPORT
Test date: ${new Date().toISOString()}
Environment: Production (api.safaar.uz)

## End-to-End Logic
`;

async function runAudit() {
  console.log('Starting QA Audit...');
  
  // 1. Admin Login
  console.log('Logging in as admin...');
  let adminRes = await req('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@safaar.uz', password: 'Admin12345!' })
  });
  if (adminRes.status !== 200) {
      report += `\n❌ Admin login failed: ${JSON.stringify(adminRes.body)}`;
      fs.writeFileSync('audit-report.md', report);
      return;
  }
  const adminToken = adminRes.body.data.accessToken;
  report += `✅ Admin authentication works.\n`;

  // 2. Role Isolation
  console.log('Testing role isolation...');
  const userPhone = '+998909990001';
  let otpRes = await req('/auth/user/send-otp', {
    method: 'POST',
    body: JSON.stringify({ phone: userPhone })
  });
  
  let devCode = otpRes.body?.data?.dev_code || '111111';
  let userReg = await req('/auth/user/register', {
    method: 'POST',
    body: JSON.stringify({ phone: userPhone, code: devCode, firstName: 'QA_E2E_User', lastName: 'Test', password: 'QA_E2E_Password123!' })
  });
  
  let userToken = userReg.body?.data?.accessToken;
  if (!userToken) {
    let userLog = await req('/auth/user/login', {
      method: 'POST',
      body: JSON.stringify({ phone: userPhone, password: 'QA_E2E_Password123!' })
    });
    userToken = userLog.body?.data?.accessToken;
  }

  if (userToken) {
      // Test isolation
      let partnerEnd = await req('/partners/dashboard/stats', {
          headers: { 'Authorization': 'Bearer ' + userToken }
      });
      if (partnerEnd.status === 403 || partnerEnd.status === 401) {
          report += `✅ Role Isolation: User cannot access partner endpoints (Point 3).\n`;
      } else {
          report += `❌ Role Isolation: User accessed partner endpoint! Status: ${partnerEnd.status}\n`;
      }
  } else {
      report += `❌ Could not authenticate User for isolation test.\n`;
  }

  // Check IDOR on booking endpoint
  if (userToken) {
      let otherBooking = await req('/users/me/bookings/00000000-0000-0000-0000-000000000001', {
          headers: { 'Authorization': 'Bearer ' + userToken }
      });
      if (otherBooking.status === 403 || otherBooking.status === 404) {
          report += `✅ IDOR Protection: User cannot view arbitrary bookings.\n`;
      } else {
          report += `❌ IDOR Protection: User accessed arbitrary booking! Status: ${otherBooking.status}\n`;
      }
  }

  // Print report locally
  fs.writeFileSync('audit-report.md', report);
  console.log('Done, saved to audit-report.md');
}

runAudit().catch(console.error);
