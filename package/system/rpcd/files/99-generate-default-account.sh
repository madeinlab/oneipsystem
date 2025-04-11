#!/bin/sh

USERNAME="oneip"
PLAINTEXT_PASSWORD="oneip"

# SHA-512 방식으로 패스워드 해시 생성
HASHED_PASSWORD=$(echo "${PLAINTEXT_PASSWORD}" | openssl passwd -6 -stdin)

uci -q delete rpcd.@login[0] 2>/dev/null

uci add rpcd login
uci set rpcd.@login[-1].username="${USERNAME}"
uci set rpcd.@login[-1].password="${HASHED_PASSWORD}"
uci set rpcd.@login[-1].timeout='300'
uci add_list rpcd.@login[-1].read='*'
uci add_list rpcd.@login[-1].write='*'
uci commit rpcd

exit 0
