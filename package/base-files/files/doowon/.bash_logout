#!/bin/bash
if [ -z "$SSH_CONNECTION" ]; then
	echo "authpriv.info logout[bash]: '${USER}' logged out  on '/dev/ttyS0'" > /dev/console
	logger -p "authpriv.info" -t "logout[bash]" "'${USER}' logged out  on '/dev/ttyS0'"
	sleep 1
fi
