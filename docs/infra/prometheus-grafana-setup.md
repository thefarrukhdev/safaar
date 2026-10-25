# Safaar Backend — Prometheus va Grafana Monitoring Qo'llanmasi

Safaar backend xizmati Prometheus formati bo'yicha real-time telemetriya va metrikalarni taqdim etadi. Ushbu hujjat Prometheus serveri orqali metrikalarni scrape qilish va Grafana dashboardlarida vizualizatsiya qilishni to'liq tavsiflaydi.

---

## 1. Metrikalar Endpoiniti

- **URL:** `GET /metrics` yoki `GET /v1/metrics`
- **Format:** Prometheus standard text (`text/plain; version=0.0.4; charset=utf-8`)
- **Kesh:** `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`
- **Throttling:** `@SkipThrottle()` (rate-limit ta'sir qilmaydi)
- **Maintenance rejimi:** Texnik xizmat rejimida ham ochiq qoladi (`MaintenanceGuard` ruxsat bergan)

### Xavfsizlik sozlamalari (`.env`)

Agar backend ochiq tarmoqda bo'lsa yoki metrikalar endpointi himoyalanishi talab etilsa:

```env
# Metrikalarni yoqish/o'chirish (standart: true)
METRICS_ENABLED=true

# Ixtiyoriy: agar belgilansa, so'rovda Token talab etiladi
METRICS_TOKEN=maxfiy_telemetriya_tokeni_123
```

So'rov jo'natish:
```bash
# Token bo'lmaganda (yoki ichki VPC tarmoqda):
curl -s http://localhost:4000/metrics

# Token belgilanganda (Bearer yoki header orqali):
curl -s -H "Authorization: Bearer maxfiy_telemetriya_tokeni_123" http://localhost:4000/metrics
# yoki
curl -s -H "x-metrics-token: maxfiy_telemetriya_tokeni_123" http://localhost:4000/metrics
```

---

## 2. Taqdim etiladigan Asosiy Metrikalar

### A. HTTP Trafik va Latency
| Metrika nomi | Turi | Label-lar | Tavsif |
|---|---|---|---|
| `safaar_http_requests_total` | Counter | `method`, `route`, `status_code` | Backend qayta ishlagan barcha HTTP so'rovlar soni |
| `safaar_http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | HTTP so'rovlar bajarilish vaqti (soniyada) |
| `safaar_http_requests_in_flight` | Gauge | `method` | Ayni paytda faol qayta ishlanayotgan so'rovlar soni |

> **Eslatma:** Kardinallik portlashining (cardinality explosion) oldini olish maqsadida barcha dinamik IDlar (`UUID`, numeric ID, cuid, tokenlar) avtomatik ravishda `:id` ga normallashtiriladi (masalan: `/v1/hotels/:id/rooms/:id`).

### B. PostgreSQL Ulanishlar Hovuzi (Connection Pool)
| Metrika nomi | Turi | Label-lar | Tavsif |
|---|---|---|---|
| `safaar_db_pool_connections` | Gauge | `state` (`total`, `idle`, `waiting`) | DB pool holati: jami ulanishlar, bo'sh ulanishlar va navbatda kutayotgan so'rovlar |

### C. Kesh va Xotira
| Metrika nomi | Turi | Label-lar | Tavsif |
|---|---|---|---|
| `safaar_cache_memory_entries` | Gauge | - | Xotiradagi (in-memory) kesh yozuvlari soni |

### D. Biznes Voqealar
| Metrika nomi | Turi | Label-lar | Tavsif |
|---|---|---|---|
| `safaar_business_events_total` | Counter | `type`, `status` | Muhim biznes amallari (bron qilish, to'lovlar, avtorizatsiya) |

### E. Node.js va Tizim Metrikalari (Default Metrics)
`collectDefaultMetrics` orqali avtomatik yig'iladi:
- `safaar_process_cpu_user_seconds_total` & `safaar_process_cpu_system_seconds_total` (CPU sarfi)
- `safaar_process_resident_memory_bytes` (RSS xotira)
- `safaar_nodejs_heap_size_total_bytes` & `safaar_nodejs_heap_size_used_bytes` (V8 Heap xotira)
- `safaar_nodejs_eventloop_lag_seconds` (Event Loop kechikishi)
- `safaar_nodejs_active_handles_total` (Faol fayl/socket deskriptorlari)
- `safaar_nodejs_gc_duration_seconds` (Garbage Collection pauzalari)

---

## 3. Prometheus Scrape Konfiguratsiyasi (`prometheus.yml`)

Prometheus serverining `prometheus.yml` fayliga quyidagi jobni qo'shing:

```yaml
scrape_configs:
  - job_name: 'safaar-backend'
    scrape_interval: 10s
    scrape_timeout: 5s
    metrics_path: '/metrics'
    # Agar METRICS_TOKEN yoqilgan bo'lsa:
    # authorization:
    #   type: Bearer
    #   credentials: 'maxfiy_telemetriya_tokeni_123'
    static_configs:
      - targets: ['api.safaar.uz:4000']
        labels:
          environment: 'production'
          app: 'safaar-backend'
```

Docker Compose orqali ishlayotgan bo'lsa:
```yaml
      - targets: ['backend:4000']
```

---

## 4. Grafana PromQL Dashboard So'rovlari

Grafana panel yaratishda quyidagi PromQL formulalaridan foydalanishingiz mumkin:

### 1. Request Rate (RPS - So'rovlar chastotasi):
```promql
sum(rate(safaar_http_requests_total{app="safaar-backend"}[1m]))
```

### 2. HTTP Xatoliklar Ulushi (Error Rate % - 5xx):
```promql
(sum(rate(safaar_http_requests_total{app="safaar-backend", status_code=~"5.."}[1m]))
 /
 sum(rate(safaar_http_requests_total{app="safaar-backend"}[1m]))) * 100
```

### 3. P95 & P99 Latency (Kechikish vaqti):
```promql
# 95-persentil (soniyada):
histogram_quantile(0.95, sum(rate(safaar_http_request_duration_seconds_bucket{app="safaar-backend"}[5m])) by (le))

# 99-persentil:
histogram_quantile(0.99, sum(rate(safaar_http_request_duration_seconds_bucket{app="safaar-backend"}[5m])) by (le))
```

### 4. Ayni paytda faol so'rovlar (In-Flight Requests):
```promql
sum(safaar_http_requests_in_flight{app="safaar-backend"})
```

### 5. PostgreSQL Ulanishlar Hovuzi (DB Pool):
```promql
safaar_db_pool_connections{app="safaar-backend"}
```
*(Total, Idle va Waiting ulanishlarni bitta Time Series grafada ko'rsatish)*

### 6. Node.js Heap Xotira (MB):
```promql
safaar_nodejs_heap_size_used_bytes{app="safaar-backend"} / 1024 / 1024
```

### 7. Event Loop Lag (ms):
```promql
safaar_nodejs_eventloop_lag_seconds{app="safaar-backend"} * 1000
```
