#!/bin/sh

cd /etc/init.d

if [ -f "hostapd_init" ]
then
mv ./hostapd_init /usr/bin
else
echo "hostapd_init NOT FOUND"
fi

cd /etc/rc.d
rm K99hostapd_init
rm S99hostapd_init

reboot
