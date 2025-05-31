#!/bin/bash
if [ -z "$SSH_CONNECTION" ]; then
	echo "authpriv.info logout[bash]: '${USER}' logged out  on '/dev/ttyS0'" > /dev/console
	echo "authpriv.info logout[bash]: '${USER}' logged out  on '/dev/ttyS0'" >> /tmp/system.log
	sleep 1
fi
