#!/usr/bin/env python3
"""
Safaar — Lighthouse & Core Web Vitals Runner
Ushbu skript Google Lighthouse orqali saytning tezligi,
Core Web Vitals va SEO/Accessibility ko'rsatkichlarini o'lchaydi
hamda Telegram va GitHub Actions uchun hisobot tayyorlaydi.
"""

import json
import os
import subprocess
import sys
import uuid

TARGET_URL = os.environ.get("TARGET_URL", "https://www.safaar.uz/uz")
OUTPUT_PATH = "/tmp/lighthouse-report.json"

def score_badge(score):
    if score >= 90:
        return "🟢"
    elif score >= 50:
        return "🟡"
    else:
        return "🔴"

def main():
    now_time = os.environ.get("NOW_TIME", "")

    print(f"=== Lighthouse audit boshlanmoqda: {TARGET_URL} ===")

    cmd = [
        "npx", "--yes", "lighthouse", TARGET_URL,
        "--chrome-flags=--headless --no-sandbox --disable-gpu",
        "--no-enable-error-reporting",
        "--output=json",
        f"--output-path={OUTPUT_PATH}",
        "--only-categories=performance,accessibility,best-practices,seo"
    ]

    try:
        subprocess.run(cmd, check=True)
    except Exception as e:
        print(f"Lighthouse ishga tushirishda xatolik: {e}", file=sys.stderr)
        sys.exit(1)

    with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    cats = data.get("categories", {})
    perf = int(cats.get("performance", {}).get("score", 0) * 100)
    a11y = int(cats.get("accessibility", {}).get("score", 0) * 100)
    bp = int(cats.get("best-practices", {}).get("score", 0) * 100)
    seo = int(cats.get("seo", {}).get("score", 0) * 100)

    audits = data.get("audits", {})
    fcp = audits.get("first-contentful-paint", {}).get("displayValue", "N/A")
    lcp = audits.get("largest-contentful-paint", {}).get("displayValue", "N/A")
    tbt = audits.get("total-blocking-time", {}).get("displayValue", "N/A")
    cls_val = audits.get("cumulative-layout-shift", {}).get("displayValue", "N/A")
    speed_index = audits.get("speed-index", {}).get("displayValue", "N/A")

    # Telegram uchun HTML xabari
    tg_lines = [
        "⚡ <b>Safaar Lighthouse & Core Web Vitals Auditi:</b>",
        "",
        f"🌐 <b>Sayt:</b> <a href=\"{TARGET_URL}\">{TARGET_URL}</a>",
        "",
        "🎯 <b>Lighthouse Ballari:</b>",
        f"• Performance: <b>{perf}/100</b> {score_badge(perf)}",
        f"• Accessibility: <b>{a11y}/100</b> {score_badge(a11y)}",
        f"• Best Practices: <b>{bp}/100</b> {score_badge(bp)}",
        f"• SEO: <b>{seo}/100</b> {score_badge(seo)}",
        "",
        "📊 <b>Core Web Vitals Ko'rsatkichlari:</b>",
        f"• <b>LCP (Katta kontent yuklanishi):</b> {lcp}",
        f"• <b>FCP (Birinchi kontent):</b> {fcp}",
        f"• <b>TBT (Bloklanish vaqti):</b> {tbt}",
        f"• <b>CLS (Kadr siljishi):</b> {cls_val}",
        f"• <b>Speed Index:</b> {speed_index}",
        "",
        f"⏱️ <b>Audit vaqti:</b> {now_time} (Toshkent vaqti)" if now_time else ""
    ]
    telegram_msg = "\n".join([line for line in tg_lines if line is not None])

    # GitHub Actions Step Summary uchun Markdown
    summary_md = f"""### ⚡ Lighthouse & Core Web Vitals Auditi ({TARGET_URL})

| Metrika | Ball | Holat |
| :--- | :--- | :--- |
| **Performance** | {perf}/100 | {score_badge(perf)} |
| **Accessibility** | {a11y}/100 | {score_badge(a11y)} |
| **Best Practices** | {bp}/100 | {score_badge(bp)} |
| **SEO** | {seo}/100 | {score_badge(seo)} |

#### Core Web Vitals
- **LCP (Largest Contentful Paint):** `{lcp}`
- **FCP (First Contentful Paint):** `{fcp}`
- **TBT (Total Blocking Time):** `{tbt}`
- **CLS (Cumulative Layout Shift):** `{cls_val}`
- **Speed Index:** `{speed_index}`
"""

    step_summary_file = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary_file:
        with open(step_summary_file, "a", encoding="utf-8") as f:
            f.write(summary_md + "\n")

    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        delim = f"EOF_{uuid.uuid4().hex}"
        with open(github_output, "a", encoding="utf-8") as f:
            f.write(f"perf_score={perf}\n")
            f.write(f"a11y_score={a11y}\n")
            f.write(f"bp_score={bp}\n")
            f.write(f"seo_score={seo}\n")
            f.write(f"message<<{delim}\n{telegram_msg}\n{delim}\n")
    else:
        print("\n" + telegram_msg)

if __name__ == "__main__":
    main()
