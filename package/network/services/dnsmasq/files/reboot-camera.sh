#!/bin/sh

ip_addr="$1"

if [ -n "$ip_addr" ]; then
    onvif-util -u admin -p admin1357 -r "$ip_addr" &
    PID=$!

    sleep 2

    if ps -p $PID > /dev/null; then
        echo "onvif-util is still running, killing process..."
        kill -9 $PID
    else
        echo "onvif-util completed within timeout."
    fi
fi

exit 0