#!/usr/bin/env python3
"""
Safaar — SSL Certificate Expiry Checker
Ushbu skript Safaar platformasining barcha 4 ta asosiy domenlarining
SSL sertifikatlarining amal qilish muddatini tekshiradi va
muddati tugashiga 14 yoki 7 kun qolganida ogohlantirish tayyorlaydi.
"""

import datetime
import html
import os
import socket
import ssl
import sys
import uuid

DOMAINS = [
    ("Mijozlar sayti", "safaar.uz"),
    ("Admin panel", "staff.safaar.uz"),
    ("Hamkor kabineti", "partner.safaar.uz"),
    ("Backend API", "api.safaar.uz")
]

WARNING_THRESHOLD_DAYS = 14
CRITICAL_THRESHOLD_DAYS = 7

def check_domain_ssl(name, domain):
    ctx = ssl.create_default_context()
    try:
        with socket.create_connection((domain, 443), timeout=10) as sock:
            with ctx.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()
                not_after_str = cert["notAfter"]
                # Format: 'Dec 10 23:59:59 2026 GMT'
                exp_date = datetime.datetime.strptime(not_after_str, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=datetime.timezone.utc)
                now = datetime.datetime.now(datetime.timezone.utc)
                days_left = (exp_date - now).days
                issuer_dict = dict(x[0] for x in cert.get("issuer", []))
                issuer = issuer_dict.get("organizationName", issuer_dict.get("commonName", "Unknown"))
                return {
                    "name": name,
                    "domain": domain,
                    "days_left": days_left,
                    "exp_date": exp_date.strftime("%Y-%m-%d"),
                    "issuer": issuer,
                    "error": None
                }
    except Exception as e:
        return {
            "name": name,
            "domain": domain,
            "days_left": -1,
            "exp_date": "Noma'lum",
            "issuer": "Noma'lum",
            "error": str(e)
        }

def main():
    now_str = os.environ.get("NOW_TIME", datetime.datetime.now().strftime("%Y-%m-%d %H:%M"))

    report_lines = []
    alert_lines = []
    is_alert = False
    alert_level = "NONE"

    print("=== Safaar SSL Expiry Check ===")

    for name, domain in DOMAINS:
        res = check_domain_ssl(name, domain)
        days_left = res["days_left"]
        exp_date = res["exp_date"]
        issuer = res["issuer"]
        err = res["error"]

        if err:
            icon = "❌"
            line = f"{icon} <b>{name} ({domain}):</b> Xatolik - {html.escape(err)}"
            report_lines.append(line)
            alert_lines.append(f"• <b>{name} ({domain})</b>: Ulanishda xatolik ({html.escape(err)})")
            is_alert = True
            alert_level = "CRITICAL"
            print(f"[{icon}] {name} ({domain}): Xatolik - {err}")
        elif days_left <= CRITICAL_THRESHOLD_DAYS:
            icon = "🚨"
            line = f"{icon} <b>{name} ({domain}):</b> {days_left} kun qoldi! (Muddati: {exp_date}, {html.escape(issuer)})"
            report_lines.append(line)
            alert_lines.append(f"• <b>{name} ({domain})</b>: Muddati tugashiga bor-yo'g'i <b>{days_left} kun</b> qoldi (Tugash sanasi: {exp_date})")
            is_alert = True
            alert_level = "CRITICAL"
            print(f"[{icon}] {name} ({domain}): {days_left} kun qoldi!")
        elif days_left <= WARNING_THRESHOLD_DAYS:
            icon = "⚠️"
            line = f"{icon} <b>{name} ({domain}):</b> {days_left} kun qoldi (Muddati: {exp_date}, {html.escape(issuer)})"
            report_lines.append(line)
            alert_lines.append(f"• <b>{name} ({domain})</b>: SSL muddati yaqinlashmoqda: <b>{days_left} kun</b> qoldi (Tugash sanasi: {exp_date})")
            is_alert = True
            if alert_level != "CRITICAL":
                alert_level = "WARNING"
            print(f"[{icon}] {name} ({domain}): {days_left} kun qoldi")
        else:
            icon = "✅"
            line = f"{icon} <b>{name} ({domain}):</b> {days_left} kun qoldi (Muddati: {exp_date}, {html.escape(issuer)})"
            report_lines.append(line)
            print(f"[{icon}] {name} ({domain}): {days_left} kun qoldi ({exp_date})")

    report_body = "%0A".join(report_lines)
    alert_details = "%0A".join(alert_lines)

    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as f:
            f.write(f"is_alert={'true' if is_alert else 'false'}\n")
            f.write(f"alert_level={alert_level}\n")
            f.write(f"report_body={report_body}\n")
            f.write(f"alert_details={alert_details}\n")
    else:
        print("\n--- Summary ---")
        print(f"is_alert: {is_alert}")
        print(f"alert_level: {alert_level}")

if __name__ == "__main__":
    main()
