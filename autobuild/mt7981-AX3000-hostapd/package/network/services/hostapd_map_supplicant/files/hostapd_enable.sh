#!/bin/sh

if [ -f "hostapd_init" ]
then
mv ./hostapd_init /etc/init.d
else
echo "hostapd_init NOT FOUND"
fi

cd /etc/rc.d
rm K99hostapd_init
rm S99hostapd_init
ln -s ../init.d/hostapd_init K99hostapd_init
ln -s ../init.d/hostapd_init S99hostapd_init

hostapd_app_path=/usr/bin
sigma_daemon_path=/sbin

chmod +x $hostapd_app_path/hostapd_app.sh
chmod +x $hostapd_app_path/hostapd_ap.sh
chmod +x $hostapd_app_path/hostapd_sta.sh
chmod +x $hostapd_app_path/hostapd_generate.sh
chmod +x $hostapd_app_path/wpa_supplicant_generate.sh
$hostapd_app_path/hostapd_ap.sh ra0 open
$hostapd_app_path/hostapd_ap.sh rax0 open
if [ -e $sigma_daemon_path/mtk_dut ]; then
        chmod +x $sigma_daemon_path/mtk_dut_jedi_hostapd_start.sh
        $sigma_daemon_path/mtk_dut_jedi_hostapd_start.sh
fi
