import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PostgresService } from '../infrastructure/postgres.service';

const cbuUrl = 'https://cbu.uz/uz/arkhiv-kursov-valyut/json/';
const trackedCurrencies = ['USD', 'EUR', 'RUB'] as const;
type TrackedCurrency = (typeof trackedCurrencies)[number];

interface CbuRate {
  Ccy?: string;
  Rate?: string;
  Date?: string;
}

interface CurrencyRateRow {
  code: string;
  rate: string | number;
  fetched_at: Date | string;
  effective_date: Date | string | null;
}

@Injectable()
export class CurrencyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CurrencyService.name);
  private refreshTimer?: NodeJS.Timeout;
  private isRefreshing = false;
  private lastRefreshAttempt = 0;

  constructor(private readonly pg: PostgresService) {}

  onModuleInit() {
    this.scheduleNextRefresh();
    void this.refreshRates().catch((error) => {
      this.logger.warn(`CBU kurslarini olish imkonsiz: ${messageOf(error)}`);
    });
  }

  onModuleDestroy() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
  }

  async getRates() {
    const latest = await this.latestRates();
    const hasRates = this.hasAllTrackedRates(latest);

    if (!hasRates) {
      // Baza hali bo'sh bo'lsa — CBU dan sinxron olishga majburmiz
      await this.refreshRates().catch((error) => {
        this.logger.warn(
          `CBU kurslarini dastlabki olish xatosi: ${messageOf(error)}`,
        );
      });
    } else if (this.isStale(latest) && !this.isRefreshing) {
      // Kurslar eskirgan bo'lsa ham, bazadagi mavjud kurslarni darhol qaytaramiz (Stale-While-Revalidate).
      // Foydalanuvchi so'rovini 10 soniya bloklamaslik uchun yangilashni asinxron fonda bajaramiz.
      const now = Date.now();
      if (now - this.lastRefreshAttempt > 15 * 60 * 1000) {
        this.lastRefreshAttempt = now;
        this.isRefreshing = true;
        void this.refreshRates()
          .catch((error) => {
            this.logger.warn(
              `CBU kurslarini fonda yangilash xatosi: ${messageOf(error)}`,
            );
          })
          .finally(() => {
            this.isRefreshing = false;
          });
      }
    }

    const rows = await this.latestRates();
    if (!this.hasAllTrackedRates(rows)) {
      throw new ServiceUnavailableException({
        code: 'CURRENCY_RATES_UNAVAILABLE',
        message: 'Valyuta kurslari hozircha mavjud emas',
      });
    }

    const updatedAt = rows.reduce<string | null>((latestDate, row) => {
      const current = new Date(row.fetched_at).toISOString();
      return !latestDate || current > latestDate ? current : latestDate;
    }, null);

    return {
      base: 'UZS',
      updatedAt,
      rates: {
        UZS: 1,
        USD: this.rateFor(rows, 'USD'),
        EUR: this.rateFor(rows, 'EUR'),
        RUB: this.rateFor(rows, 'RUB'),
      },
    };
  }

  async refreshRates() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4_000);
    try {
      const response = await fetch(cbuUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`CBU javobi: ${response.status}`);
      }

      const payload = (await response.json()) as CbuRate[];
      const rows = trackedCurrencies.map((code) => {
        const item = payload.find((rate) => rate.Ccy === code);
        if (!item) throw new Error(`${code} kursi CBU javobida topilmadi`);
        const rate = Number(String(item.Rate ?? '').replace(',', '.'));
        if (!Number.isFinite(rate) || rate <= 0) {
          throw new Error(`${code} kursi noto‘g‘ri`);
        }
        return {
          code,
          rate,
          effectiveDate: parseCbuDate(item.Date),
        };
      });

      const fetchedAt = new Date().toISOString();
      for (const row of rows) {
        await this.pg.query(
          `INSERT INTO currency_rates
             (id, code, base, rate, source, effective_date, fetched_at, created_at)
           VALUES ($1, $2, 'UZS', $3, 'cbu.uz', $4, $5, $5)`,
          [randomUUID(), row.code, row.rate, row.effectiveDate, fetchedAt],
        );
      }

      return rows;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async latestRates(): Promise<CurrencyRateRow[]> {
    return this.pg.query<CurrencyRateRow>(
      `SELECT DISTINCT ON (code)
          code::text, rate::text, fetched_at, effective_date
       FROM currency_rates
       WHERE code = ANY($1::text[])
       ORDER BY code, fetched_at DESC`,
      [[...trackedCurrencies]],
    );
  }

  private hasAllTrackedRates(rows: CurrencyRateRow[]): boolean {
    const codes = new Set(rows.map((row) => row.code.trim().toUpperCase()));
    return trackedCurrencies.every((code) => codes.has(code));
  }

  private isStale(rows: CurrencyRateRow[]): boolean {
    if (rows.length === 0) return true;
    const oldestFetchedAt = rows.reduce((oldest, row) => {
      const timestamp = new Date(row.fetched_at).getTime();
      return Math.min(oldest, timestamp);
    }, Number.POSITIVE_INFINITY);
    return Date.now() - oldestFetchedAt > 26 * 60 * 60 * 1000;
  }

  private rateFor(rows: CurrencyRateRow[], code: TrackedCurrency): number {
    const row = rows.find((item) => item.code.trim().toUpperCase() === code);
    return Number(row?.rate ?? 0);
  }

  private scheduleNextRefresh() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      void this.refreshRates()
        .catch((error) => {
          this.logger.warn(
            `CBU kurslarini reja bo‘yicha olish xatosi: ${messageOf(error)}`,
          );
        })
        .finally(() => this.scheduleNextRefresh());
    }, msUntilNextNine());
  }
}

function parseCbuDate(value: string | undefined): string | null {
  if (!value) return null;
  const [day, month, year] = value.split('.').map(Number);
  if (!day || !month || !year) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function msUntilNextNine(now = new Date()): number {
  const next = new Date(now);
  next.setHours(9, 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
