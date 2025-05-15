#!/bin/bash

# Set Model Name by mtk_factory_rw.sh
echo "Setting Model Name: $1"

if [ -z "$1" ]; then
    echo "Usage: $0 <ModelNameString>"
    exit 1
fi

# 문자열을 hex로 변환 (공백으로 구분, 32바이트 미만이면 00으로 패딩)
model="$1"
hex=""
for ((i=0; i<${#model}; i++)); do
    hex+=$(printf "%02X " "'${model:$i:1}")
done
# 패딩 (32바이트)
for ((i=${#model}; i<32; i++)); do
    hex+="00 "
done

# 마지막 공백 제거
hex=$(echo "$hex" | sed 's/ *$//')

echo "Hex: $hex"
/sbin/mtk_factory_rw.sh -w model $hex

