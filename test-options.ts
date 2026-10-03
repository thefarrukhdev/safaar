import fs from "fs";
const content = fs.readFileSync("apps/web-user/components/features/checkout/PaymentSelector.tsx", "utf-8");
const match = content.match(/const PAYMENT_OPTIONS[\s\S]*?as const;/);
console.log(match[0]);
