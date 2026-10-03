import React from 'react';
import { renderToString } from 'react-dom/server';
import { PaymentSelector } from './apps/web-user/components/features/checkout/PaymentSelector';

const dict = {
  paymentMethods: {
    local_card: { title: "Karta orqali to'lash", desc: "...", badges: [] },
    cash: { title: "Joyida to'lash", desc: "...", badges: [] }
  }
};

const html = renderToString(<PaymentSelector dict={dict.paymentMethods} />);
console.log(html);
