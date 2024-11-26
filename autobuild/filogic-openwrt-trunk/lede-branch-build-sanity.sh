#!/bin/bash
source ./autobuild/lede-build-sanity.sh

rm -rf ./autobuild/openwrt_patches/mtk_soc/0003-fstool-mtk-samba-test.patch

#get the brach_name
temp=${0%/*}
branch_name=${temp##*/}
chip_name="filogic"

# use our special feeds to replace original feeds
cp ./autobuild/$branch_name/feeds.conf.default ../mtk-openwrt-feeds
# use our prepare_sdk script and remove list to replace original files
cp ./autobuild/$branch_name/prepare_sdk.sh ../mtk-openwrt-feeds
cp ./autobuild/$branch_name/remove.patch.list ../mtk-openwrt-feeds
# fix system/fstool package build fail by removing internal samba patch

#step1 clean
#clean
#step2 choose which .config

#do prepare stuff
prepare

#prepare mtk jedi wifi stuff
prepare_mtwifi ${branch_name}

prepare_final ${branch_name}
#step3 build
if [ -z ${1} ] || [ $1 = "6E" ]; then
	build ${branch_name} -j1 || [ "$LOCAL" != "1" ]
fi
exit 0
