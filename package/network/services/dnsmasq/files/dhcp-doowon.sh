#!/bin/sh

echo "Running... dhcp-doowon.sh ARGS[$@]"
# Running... dhcp-doowon.sh ARGS[old a4:58:0f:e0:42:d4 209.142.67.127 N2M-6S385A4580FE042D4]

# action: add, old, del
action="$1"
mac_addr="$2"
ip_addr="$3"
name="$4"

DUMP_FILE_PATH="/etc/cameras/cam"

# Validate IP format and range: Only accept 209.142.67.xx
if ! echo "$ip_addr" | grep -Eo '^209\.142\.67\.[0-9]+$' > /dev/null; then
    echo "Invalid IP format or out of range: $ip_addr"
    exit 1
fi

last_octet=$(echo "$ip_addr" | awk -F. '{print $4}')
if [ "$((last_octet % 10))" -ne 0 ] || [ "$((last_octet / 10))" -lt 1 ] || [ "$((last_octet / 10))" -gt 8 ]; then
    if [ "$action" = "add" ] || [ "$action" = "old" ]; then
        ping -c 3 -W 2 "$ip_addr" > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo "Invalid IP address, rebooting camera..."
            . /usr/lib/dnsmasq/reboot-camera.sh "$ip_addr"
        else
            echo "Camera IP is unreachable."
        fi
        exit 1
    fi
else
    DUMP_FILE_PATH="$DUMP_FILE_PATH$((last_octet / 10))"
fi

# Load JSON utilities
if ! [ -f "./usr/share/libubox/jshn.sh" ]; then
    echo "JSON utility not found!"
    exit 1
fi

. /usr/share/libubox/jshn.sh
json_init
json_add_string "ip" "$ip_addr"
json_close_object

if [ "$action" = "add" ] || [ "$action" = "old" ]; then
    if [ ! -f "$DUMP_FILE_PATH" ]; then
        ubus call luci addCamera "$(json_dump)" > /dev/null 2>&1
    fi
elif [ "$action" = "del" ]; then
    if [ -f "$DUMP_FILE_PATH" ]; then
        ubus call luci removeCamera "$(json_dump)" > /dev/null 2>&1
    fi
fi

exit 0
