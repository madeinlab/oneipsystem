#!/bin/sh

echo "Running... dhcp-doowon.sh ARGS[$@]"
# Running... dhcp-doowon.sh ARGS[old a4:58:0f:e0:42:d4 209.142.67.127 N2M-6S385A4580FE042D4]

# action: add, old, del
action="$1"
mac_addr="$2"
ip_addr="$3"
name="$4"

. /usr/share/libubox/jshn.sh
json_init

json_add_string "ip" "$ip_addr"

json_close_object

if [ "$action" = "add" ] || [ "$action" = "old" ]; then
    ubus call luci addCamera "$(json_dump)"
elif [ "$action" = "del" ]; then
    ubus call luci removeCamera "$(json_dump)"
fi
