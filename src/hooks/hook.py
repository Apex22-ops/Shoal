"""Shoal: forwards a Claude Code hook event to the local Shoal server.

Usage: python3 hook.py <start|prompt|pretool|tool|stop|notify>   (hook JSON on stdin)

Claude Code waits for this script twice per tool call (PreToolUse + PostToolUse), so it is kept
as small as possible: run with -S semantics (no site import needed), no urllib, a raw HTTP request
over a socket. Does nothing outside Shoal, or inside Shoal's own background Haiku calls.
"""
import json
import os
import socket
import sys

sid, port, token = (os.environ.get(k) for k in ("SHOAL_ID", "SHOAL_PORT", "SHOAL_TOKEN"))
if not sid or not port or not token or os.environ.get("SHOAL_INTERNAL"):
    sys.exit(0)

event = sys.argv[1] if len(sys.argv) > 1 else ""
if event == "tool":
    sys.stdin.buffer.read()  # drain stdin without decoding it: tool outputs are never sent
    data = {}
else:
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}
    if event == "pretool":
        # only what is needed to show a pending permission: tool name + the gist of the request
        ti = data.get("tool_input") or {}
        detail = (ti.get("command") or ti.get("file_path") or ti.get("url") or ti.get("path")
                  or ti.get("pattern") or ti.get("description") or "")
        data = {"tool_name": data.get("tool_name", ""), "detail": " ".join(str(detail).split())[:200]}

try:
    body = json.dumps({"id": sid, "event": event, "data": data}).encode()
    head = (f"POST /hook HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nContent-Type: application/json\r\n"
            f"X-Shoal-Token: {token}\r\nContent-Length: {len(body)}\r\nConnection: close\r\n\r\n").encode()
    s = socket.create_connection(("127.0.0.1", int(port)), timeout=2)
    s.sendall(head + body)
    s.recv(64)  # wait for the reply so events keep their order
    s.close()
except Exception:
    pass
sys.exit(0)
