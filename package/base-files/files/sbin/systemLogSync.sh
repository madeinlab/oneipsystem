#!/bin/sh

SRC=/tmp/system.log

# Check run process
EXIST_CHECK_LINK=/tmp/running_check_systemLog
if [ -e $EXIST_CHECK_LINK ]; then
 exit 0
else
 touch ${EXIST_CHECK_LINK}
fi

/usr/bin/inotifywait -m $SRC -e close_write | while read; do /usr/sbin/logrotate /etc/logrotate.d/system_log; done &

echo "SYSTEM LOG ROTATE" > /dev/console
logger -p "daemon.notice" -t "procd" "- logrotate -"

