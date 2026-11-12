"""Shoal: invisible Claude Code status line.

Claude Code runs it every 60 s and after each reply. It prints nothing (Shoal shows the context
gauge at the top of the window and the weekly limit in the sidebar) and only reports the context
size, the model and the rate limits to the local Shoal server. It also appends the limits to
usage-log.csv in Shoal's data folder, which lets Shoal rebuild today's usage after a restart.
"""
import json
import os
import socket
import sys
import time

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

sid, port, token, data_dir = (os.environ.get(k) for k in ("SHOAL_ID", "SHOAL_PORT", "SHOAL_TOKEN", "SHOAL_DATA"))
if not sid or not port or not token:
    sys.exit(0)

model = (data.get("model") or {}).get("display_name") or ""
ctx = int((data.get("context_window") or {}).get("used_percentage") or 0)
limits = data.get("rate_limits") or None


def pct(window):
    v = ((limits or {}).get(window) or {}).get("used_percentage")
    return "" if v is None else str(int(v))


h5, d7 = pct("five_hour"), pct("seven_day")
if data_dir and (h5 or d7):
    log = os.path.join(data_dir, "usage-log.csv")
    entry = f"{h5},{d7},{model.replace(',', ' ')}"
    last = ""
    try:
        with open(log, "rb") as f:
            f.seek(0, 2)
            f.seek(max(0, f.tell() - 200))
            last = f.read().decode("utf-8", "ignore").strip().split("\n")[-1].split(",", 1)[-1]
    except OSError:
        pass
    if entry != last:
        try:
            with open(log, "a") as f:
                f.write(time.strftime("%Y-%m-%d %H:%M") + "," + entry + "\n")
        except OSError:
            pass

try:
    body = json.dumps({"id": sid, "ctx": ctx, "model": model, "rate_limits": limits}).encode()
    head = (f"POST /usage HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nContent-Type: application/json\r\n"
            f"X-Shoal-Token: {token}\r\nContent-Length: {len(body)}\r\nConnection: close\r\n\r\n").encode()
    s = socket.create_connection(("127.0.0.1", int(port)), timeout=1)
    s.sendall(head + body)
    s.recv(64)
    s.close()
except Exception:
    pass
