#!/usr/bin/env python3
"""
Safaar — Format Pull Request Telegram Notification
Ushbu skript GitHub Actions muhitida PR ma'lumotlarini qabul qilib,
Telegram HTML formatidagi chiroyli, xavfsiz (HTML-escaped) xabarni generatsiya qiladi.
"""

import html
import json
import os
import subprocess
import sys
import uuid

def main():
    event_name = os.environ.get("EVENT_NAME", "pull_request")
    now = os.environ.get("PR_TIME", "")

    labels = []
    action_note = ""

    if event_name == "workflow_dispatch":
        # Qo'lda sinov uchun mavjud PR ma'lumotlarini GitHub CLI orqali yuklash
        test_pr = os.environ.get("TEST_PR", "4") or "4"
        cmd = [
            "gh", "pr", "view", test_pr,
            "--json", "number,title,author,headRefName,baseRefName,additions,deletions,changedFiles,url,state,mergedAt,mergedBy,isDraft,body,labels"
        ]
        repo = os.environ.get("GITHUB_REPOSITORY")
        if repo:
            cmd.extend(["-R", repo])

        try:
            res = subprocess.run(cmd, capture_output=True, text=True, check=True)
            data = json.loads(res.stdout)
        except Exception as e:
            data = {
                "number": test_pr,
                "title": f"Test Pull Request #{test_pr}",
                "author": {"login": os.environ.get("GITHUB_ACTOR", "test-user")},
                "headRefName": "develop",
                "baseRefName": "main",
                "additions": 10,
                "deletions": 2,
                "changedFiles": 3,
                "url": f"https://github.com/{repo or 'thefarrukhdev/safaar'}/pull/{test_pr}",
                "body": "Bu qo'lda yuborilgan test bildirishnomasi.",
                "state": "OPEN",
                "labels": [{"name": "area:devops"}]
            }

        number = data.get("number", test_pr)
        title = data.get("title", "")
        user = (data.get("author") or {}).get("login", "")
        merged_by = (data.get("mergedBy") or {}).get("login", "")
        head_ref = data.get("headRefName", "")
        base_ref = data.get("baseRefName", "")
        additions = data.get("additions", 0)
        deletions = data.get("deletions", 0)
        changed_files = data.get("changedFiles", 0)
        url = data.get("url", "")
        raw_body = data.get("body", "")
        state = data.get("state", "OPEN")
        labels = [l.get("name") for l in data.get("labels", []) if isinstance(l, dict) and l.get("name")]

        if state == "MERGED":
            header = "🟣 <b>[TEST] Pull Request Merge Qilindi:</b>"
            if merged_by:
                action_note = f"👤 <b>Merge qildi:</b> @{html.escape(merged_by)}"
        elif state == "CLOSED":
            header = "⚪ <b>[TEST] Pull Request Yopildi (Bekor qilindi):</b>"
        else:
            header = "🟢 <b>[TEST] Yangi Pull Request Ochildi:</b>"

    else:
        # Haqiqiy pull_request eventidan o'qish
        action = os.environ.get("PR_ACTION", "opened")
        is_merged = os.environ.get("PR_MERGED", "false").lower() == "true"
        is_draft = os.environ.get("PR_DRAFT", "false").lower() == "true"
        number = os.environ.get("PR_NUMBER", "")
        title = os.environ.get("PR_TITLE", "")
        user = os.environ.get("PR_USER", "")
        merged_by = os.environ.get("PR_MERGED_BY", "")
        head_ref = os.environ.get("PR_HEAD", "")
        base_ref = os.environ.get("PR_BASE", "")
        additions = os.environ.get("PR_ADDITIONS", "0")
        deletions = os.environ.get("PR_DELETIONS", "0")
        changed_files = os.environ.get("PR_CHANGED_FILES", "0")
        url = os.environ.get("PR_URL", "")
        raw_body = os.environ.get("PR_BODY", "")

        raw_labels = os.environ.get("PR_LABELS_JSON", "[]")
        try:
            parsed = json.loads(raw_labels)
            labels = [l.get("name") for l in parsed if isinstance(l, dict) and l.get("name")]
        except Exception:
            labels = []

        if action == "closed":
            if is_merged:
                header = "🟣 <b>Pull Request Merge Qilindi!</b>"
                if merged_by:
                    action_note = f"👤 <b>Merge qildi:</b> @{html.escape(merged_by)}"
            else:
                header = "⚪ <b>Pull Request Yopildi (Bekor qilindi)</b>"
        elif action == "opened":
            if is_draft:
                header = "📝 <b>Yangi PR (Qoralama / Draft):</b>"
            else:
                header = "🟢 <b>Yangi Pull Request Ochildi!</b>"
        elif action == "ready_for_review":
            header = "👀 <b>Pull Request Ko‘rib Chiqishga Tayyor (Review):</b>"
        elif action == "reopened":
            header = "🔄 <b>Pull Request Qayta Ochildi!</b>"
        else:
            header = f"ℹ️ <b>Pull Request ({html.escape(action)}):</b>"

    # Matnlarni xavfsiz escape qilish
    escaped_title = html.escape(str(title))
    escaped_user = html.escape(str(user))
    escaped_head = html.escape(str(head_ref))
    escaped_base = html.escape(str(base_ref))

    # PR tavsifini qisqartirish va tozalash (maksimal 3 qator / 250 belgi)
    body_clean = ""
    if raw_body:
        lines = [line.strip() for line in raw_body.strip().splitlines() if line.strip()]
        first_lines = "\n".join(lines[:3])
        if len(first_lines) > 250:
            first_lines = first_lines[:247] + "..."
        body_clean = html.escape(first_lines)

    msg_lines = [
        header,
        "",
        f"📌 <b>PR:</b> <a href=\"{url}\">#{number} — {escaped_title}</a>",
        f"👤 <b>Muallif:</b> @{escaped_user}",
        f"🌿 <b>Filial:</b> <code>{escaped_head}</code> ➔ <code>{escaped_base}</code>",
        f"📊 <b>O‘zgarishlar:</b> +{additions} / -{deletions} ({changed_files} ta fayl)"
    ]

    if action_note:
        msg_lines.append(action_note)

    if labels:
        label_str = ", ".join([f"<code>{html.escape(l)}</code>" for l in labels])
        msg_lines.append(f"🏷️ <b>Teglar:</b> {label_str}")

    if body_clean:
        msg_lines.extend(["", "💬 <b>Tavsif:</b>", f"<i>{body_clean}</i>"])

    msg_lines.extend([
        "",
        f"⏱️ <b>Vaqt:</b> {now} (Toshkent vaqti)" if now else "",
        f"🔗 <a href=\"{url}\">GitHub'da ko‘rish ↗</a>"
    ])

    final_msg = "\n".join([line for line in msg_lines if line is not None])

    # GITHUB_OUTPUT fayliga yozish
    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        delimiter = f"EOF_{uuid.uuid4().hex}"
        with open(github_output, "a", encoding="utf-8") as f:
            f.write(f"message<<{delimiter}\n{final_msg}\n{delimiter}\n")
    else:
        print(final_msg)

if __name__ == "__main__":
    main()
