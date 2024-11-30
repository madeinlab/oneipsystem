#!/bin/bash
ps aux | grep socat | grep "TCP-LISTEN:$1" > /dev/null
rv=`echo $?`
echo $rv
exit $(( rv ))
