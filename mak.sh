#!/bin/bash

echo -n "make -j$(nproc)..."
#echo -n "make -j$(($(nproc) - 2))..."

if [ $SCRIPT_PROGESS ]; then
	if [ $SCRIPT_PROGESS == 1 ]; then
		exit 0
	fi
fi

export SCRIPT_PROGESS=1

SECONDS_OF_DAY=86400
SECONDS_OF_HOUR=3600
SECONDS_OF_MINUTE=60

START_TIME=`date`
START_TIME_sec=`date +%s`
START_TEST_DATE=`date +%F_%T`

FILENAME=/dev/null

if [ -f $FILENAME ]; then
	TEST_CNT=`tail -n 1 $FILENAME | awk '{print $1}'`
	TEST_CNT=`expr $TEST_CNT + 1`
	TEST_FAIL_CNT=`tail -n 1 $FILENAME | awk '{print $2}'`
else
	TEST_CNT=1
	TEST_FAIL_CNT=0
	touch $FILENAME
fi

echo "$TEST_CNT"
make -j$(nproc)
#make -j$(($(nproc) - 2))

END_TEST_DATE=`date +%F_%T`

awk -v tc="$TEST_CNT" -v tfc="$TEST_FAIL_CNT" -v std="$START_TEST_DATE" -v etd="$END_TEST_DATE" \
    -v pp="$PCIe_Pass" -v ip="$INTERFACE_Pass" -v pdn="$PCIe_DETECT_NUM" \
	-v idn="$INTERFACE_DETECT_NUM" \
	'BEGIN {printf "%4d %4d  %s  %s  ", tc, tfc, std, etd;
			if(pp) printf "PCIe:OK   Detect %d  ", pdn
			else printf "PCIe:Fail Detect %d  ", pdn
			if(ip) printf "INTERFACE:OK\n"
			else printf "INTERFACE:Fail, Detect %d\n", idn}' >> $FILENAME


END_TIME=`date`
END_TIME_sec=`date +%s`

#let RUN_TIME=$END_TIME_sec-$START_TIME_sec
RUN_TIME=`expr $END_TIME_sec - $START_TIME_sec`


if [ $RUN_TIME -gt $SECONDS_OF_DAY ]; then
	DAYS=`expr $RUN_TIME / $SECONDS_OF_DAY`
else
	DAYS=0
fi

if [ $RUN_TIME -gt $SECONDS_OF_HOUR ]; then
	HOURS=`expr $RUN_TIME % $SECONDS_OF_DAY`
	HOURS=`expr $HOURS / $SECONDS_OF_HOUR`
else
	HOURS=0
fi

if [ $RUN_TIME -gt $SECONDS_OF_MINUTE ]; then
	MINUTES=`expr $RUN_TIME % $SECONDS_OF_HOUR`
	MINUTES=`expr $MINUTES / $SECONDS_OF_MINUTE`
else
	MINUTES=0
fi

SECONDS=`expr $RUN_TIME % $SECONDS_OF_MINUTE`

echo "START_TIME : $START_TIME"
echo "  END_TIME : $END_TIME"
awk -v d="$DAYS" -v h="$HOURS" -v m="$MINUTES" -v sec="$SECONDS" \
		'BEGIN {printf "  RUN_TIME : ";
                if(d)      printf "%dday %dhour %dmin %2dsec\n", d, h, m, sec;
				else if(h) printf "%dhour %dmin %dsec\n", h, m, sec;
				else if(m) printf "%dmin %dsec\n", m, sec;
				else       printf "%d seconds\n", sec}'

IMG_POS=`pwd`
IMG_NAME=one.${IMG_POS##*/}.bin
DEST_DIR="/home/lssnow/images"
if [ -d $DEST_DIR ]; then
	echo "cp bin/targets/mediatek/mt7981-glibc/*sysupgrade.bin ~/images/${IMG_NAME}"
	cp bin/targets/mediatek/mt7981-glibc/*sysupgrade.bin ~/images/${IMG_NAME}
fi

export SCRIPT_PROGESS=0

