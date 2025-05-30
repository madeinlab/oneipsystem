#!/bin/sh

echo "Running... dhcp-doowon.sh ARGS[$@]"
# Running... dhcp-doowon.sh ARGS[old a4:58:0f:e0:42:d4 209.142.67.127 N2M-6S385A4580FE042D4]

# action: add, old, del
action="$1"
mac_addr="$2"
ip_addr="$3"
name="$4"

# Load JSON utilities
. /usr/share/libubox/jshn.sh

json_init
json_add_string "action" "$action"
json_add_string "mac" "$mac_addr"
json_add_string "ip" "$ip_addr"
json_add_string "name" "$name"
json_close_object

#ubus call luci handleCameraEvent "$(json_dump)"
PARAMS="$(json_dump)"
if [ -n "$PARAMS" ]; then
  ubus call luci handleCameraEvent "$PARAMS"
fi

exit 0
