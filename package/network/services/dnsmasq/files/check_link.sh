#!/bin/sh

# Check run process
EXIST_CHECK_LINK=/tmp/running_check_link
if [ -e $EXIST_CHECK_LINK ]; then
	exit 0
else
	touch ${EXIST_CHECK_LINK}
fi

CAMERA_CONF=/etc/config/camera
CAMERA_CONF_DEFAULT=/etc/config/camera_default
if [ -e $CAMERA_CONF ]; then
	echo "Initialize 'Camera config'"
	rm ${CAMERA_CONF}
	cp ${CAMERA_CONF_DEFAULT} ${CAMERA_CONF}
	rm -rf /etc/camera/*.dump
	rm -rf /www/hls/stream/*
fi

# For TEST
#MAC_FILE=./test_MAC_file.txt
#LINK_FILE=./test_link.txt
#DHCP_FILE=./test_dhcp-host.doowon
#DNSMASQ_PID=

# For Real System
MAC_FILE=/proc/rtk_gsw/mac
LINK_FILE=/proc/rtk_gsw/link
DHCP_FILE=/usr/lib/dnsmasq/dhcp-host.doowon
DNSMASQ_PID=/var/run/dnsmasq/dnsmasq.cfg01411c.pid

mac2dhcp(){
	PORT1_MAC=`sed -n '1s/[0-9]  //p' ${MAC_FILE}`
	PORT2_MAC=`sed -n '2s/[0-9]  //p' ${MAC_FILE}`
	PORT3_MAC=`sed -n '3s/[0-9]  //p' ${MAC_FILE}`
	PORT4_MAC=`sed -n '4s/[0-9]  //p' ${MAC_FILE}`
	PORT5_MAC=`sed -n '5s/[0-9]  //p' ${MAC_FILE}`
	PORT6_MAC=`sed -n '6s/[0-9]  //p' ${MAC_FILE}`
	PORT7_MAC=`sed -n '7s/[0-9]  //p' ${MAC_FILE}`
	PORT8_MAC=`sed -n '8s/[0-9]  //p' ${MAC_FILE}`

	sed -i "1s/\([a-fA-F0-9]\{2\}\(:[a-fA-F0-9]\{2\}\)\{5\}\),\(.*,,.*\)/${PORT1_MAC},\3/g" ${DHCP_FILE}
	sed -i "2s/\([a-fA-F0-9]\{2\}\(:[a-fA-F0-9]\{2\}\)\{5\}\),\(.*,,.*\)/${PORT2_MAC},\3/g" ${DHCP_FILE}
	sed -i "3s/\([a-fA-F0-9]\{2\}\(:[a-fA-F0-9]\{2\}\)\{5\}\),\(.*,,.*\)/${PORT3_MAC},\3/g" ${DHCP_FILE}
	sed -i "4s/\([a-fA-F0-9]\{2\}\(:[a-fA-F0-9]\{2\}\)\{5\}\),\(.*,,.*\)/${PORT4_MAC},\3/g" ${DHCP_FILE}
	sed -i "5s/\([a-fA-F0-9]\{2\}\(:[a-fA-F0-9]\{2\}\)\{5\}\),\(.*,,.*\)/${PORT5_MAC},\3/g" ${DHCP_FILE}
	sed -i "6s/\([a-fA-F0-9]\{2\}\(:[a-fA-F0-9]\{2\}\)\{5\}\),\(.*,,.*\)/${PORT6_MAC},\3/g" ${DHCP_FILE}
	sed -i "7s/\([a-fA-F0-9]\{2\}\(:[a-fA-F0-9]\{2\}\)\{5\}\),\(.*,,.*\)/${PORT7_MAC},\3/g" ${DHCP_FILE}
	sed -i "8s/\([a-fA-F0-9]\{2\}\(:[a-fA-F0-9]\{2\}\)\{5\}\),\(.*,,.*\)/${PORT8_MAC},\3/g" ${DHCP_FILE}
}

NOLINK="00000000"
currentLink=${NOLINK}
priviousLink=${NOLINK}

PORT_NUM=$(seq 0 7)
LINK0='DOWN'
LINK1='UP'

# fast update
#mac2dhcp
#sync

while true; do
	if [ -e "$LINK_FILE" ]; then
		currentLink=`cat ${LINK_FILE}`
	else
		currentLink=${NOLINK}
	fi

    sleep 1

    if [ ${priviousLink} != ${currentLink} ]; then
		DHCP_ACT="0"
        for i in ${PORT_NUM}; do
            #priLink=${priviousLink:i:1}
            #curLink=${currentLink:i:1}
			priLink=`echo ${priviousLink} | cut -c $((i+1))`
			curLink=`echo ${currentLink} | cut -c $((i+1))`

            if [ ${priLink} -ne ${curLink} ]; then
                port=`expr $i + 1`
                priLinkStr=LINK$priLink
                curLinkStr=LINK$curLink

				if [ ${curLink} -eq "1" ]; then
					DHCP_ACT=`expr ${DHCP_ACT} + $((curLink))`
					logger -p "daemon.notice" -t "netifd" "Switch port ${port} link is up"
					echo "daemon.notice netifd:Switch port ${port} link is up" > /dev/console
				else
					logger -p "daemon.notice" -t "netifd" "Switch port ${port} link is down"
					echo "daemon.notice netifd:Switch port ${port} link is down" > /dev/console
					ip -s -s neigh flush all
				fi
            fi
        done

		if [ -e $DNSMASQ_PID ]; then
			# SIGHUP by manual
			if [ ${DHCP_ACT} != "0" ]; then
				# Update switch running MAC address to DHCP host
				mac2dhcp;sync;sleep 1
				kill -1 `cat ${DNSMASQ_PID}`
			fi
		else
			if [ -e $DHCP_FILE ]; then
				if [ ${DHCP_ACT} != "0" ]; then
					mac2dhcp;sync;sleep 1
				fi
			else
				continue
			fi
		fi
    fi

    priviousLink=${currentLink}
done

