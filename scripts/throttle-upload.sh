#!/usr/bin/env bash
# Throttle YOUR OUTBOUND bandwidth so uploads are genuinely slow.
#
# Run this on the LAPTOP you're testing from — not on the server.
#
# Why not DevTools: Chrome/Firefox network throttling is REQUEST-level, not
# packet-level — the delay is applied once the response comes back, so a request
# body has already gone out at full speed. Uploads are simply not throttled.
# `tc` shapes the real egress queue, so it slows the actual bytes leaving the NIC,
# which is the only way to reproduce a slow upload (and nginx's 300s
# client_body_timeout → HTTP 408, which is how ~20 Android uploads died on Jul 13).
#
#   sudo ./throttle-upload.sh on 200kbit    # a bad mobile uplink
#   sudo ./throttle-upload.sh on 50kbit     # a truly awful one — expect 408s
#   sudo ./throttle-upload.sh status
#   sudo ./throttle-upload.sh off           # ALWAYS run this when you're done
#
# This throttles ALL upload traffic from the machine, not just 3Speak. It is a
# blunt instrument; turn it off afterwards or your whole box stays slow.
set -euo pipefail

CMD="${1:-status}"
RATE="${2:-200kbit}"

# The interface carrying your default route.
IFACE="$(ip route show default 2>/dev/null | awk '/default/ {print $5; exit}')"
if [ -z "${IFACE:-}" ]; then
  echo "Could not work out the default interface. Pass it: IFACE=wlan0 $0 ..." >&2
  exit 1
fi
IFACE="${IFACE_OVERRIDE:-$IFACE}"

case "$CMD" in
  on)
    tc qdisc del dev "$IFACE" root 2>/dev/null || true
    # tbf = token bucket filter: a hard ceiling on egress rate.
    # latency = how long a packet may sit in the queue before being dropped; it has
    # to be generous or a big upload gets its packets dropped instead of just slowed.
    tc qdisc add dev "$IFACE" root tbf rate "$RATE" burst 32kbit latency 400ms
    echo "Upload throttled to $RATE on $IFACE."
    echo "Reference: a 512KB chunk needs ~14 kbit/s to land inside nginx's 300s body timeout;"
    echo "           the OLD 5MB chunks needed ~140 kbit/s — which is why they 408'd."
    echo "Turn it off with: sudo $0 off"
    ;;
  off)
    tc qdisc del dev "$IFACE" root 2>/dev/null || true
    echo "Throttle removed from $IFACE."
    ;;
  status)
    echo "iface: $IFACE"
    tc qdisc show dev "$IFACE"
    ;;
  *)
    echo "usage: sudo $0 {on <rate>|off|status}" >&2
    exit 1
    ;;
esac
