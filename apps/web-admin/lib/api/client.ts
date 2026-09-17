import axios from "axios";
import Cookies from "js-cookie";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api/backend",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach token
apiClient.interceptors.request.use(
  (config) => {
    const token = Cookies.get("admin_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Dashboard/CMS sahifalari mount bo'lganda bir nechta so'rovni PARALLEL
// yuboradi (masalan /dashboard: overview + support/stats + partners/
// requests + notifications birdaniga). Token yaroqsiz bo'lganda ULARNING
// HAMMASI 401 qaytaradi va, guard bo'lmasa, HAR BIRI mustaqil ravishda
// o'z window.location.href="/login" chaqiruvini beradi — bir nechta
// deyarli bir vaqtdagi to'liq sahifa navigatsiyasi (real productionda
// kuzatilgan "tinimsiz reload"/ko'p 307 redirect simptomining sababi).
// Bu flag har bir to'liq sahifa yuklanishida (module qayta ishga tushganda)
// tabiiy ravishda qayta tiklanadi, shuning uchun keyingi haqiqiy sessiya
// tugashini bloklamaydi — faqat BITTA "yaroqsiz sessiya" hodisasi ichidagi
// ortiqcha qayta-redirectlarni yo'q qiladi.
let isRedirectingToLogin = false;

// Response interceptor: handle 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => {
    if (
      response.data &&
      typeof response.data === "object" &&
      "success" in response.data &&
      "data" in response.data
    ) {
      response.data = response.data.data;
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      if (
        typeof window !== "undefined" &&
        !isRedirectingToLogin &&
        window.location.pathname !== "/login"
      ) {
        isRedirectingToLogin = true;
        // Token is expired or invalid
        Cookies.remove("admin_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
