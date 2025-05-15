#!/bin/bash

# Set Serial Number by mtk_factory_rw.sh
echo "Setting Serial Number: $1"

if [ -z "$1" ]; then
    echo "Usage: $0 <SerialNumberString>"
    exit 1
fi

# 문자열을 hex로 변환 (공백으로 구분, 16바이트 미만이면 00으로 패딩)
serial="$1"
hex=""
for ((i=0; i<${#serial}; i++)); do
    hex+=$(printf "%02X " "'${serial:$i:1}")
done
# 패딩 (16바이트)
for ((i=${#serial}; i<16; i++)); do
    hex+="00 "
done

# 마지막 공백 제거
hex=$(echo "$hex" | sed 's/ *$//')

echo "Hex: $hex"
/sbin/mtk_factory_rw.sh -w serial_no $hex

