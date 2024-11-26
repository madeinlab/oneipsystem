#!/bin/bash

MTK_FEEDS_DIR=${1}

if [ -f feeds.conf.default_ori ]; then
	OPENWRT_VER=`cat ./feeds.conf.default_ori | grep "src-git packages" | awk -F ";openwrt" '{print $2}'`

	if [ -z ${OPENWRT_VER} ]; then
		OPENWRT_VER=`cat ./feeds.conf.default_ori | grep "src-git-full packages" | awk -F ";openwrt" '{print $2}'`
	fi
else
	OPENWRT_VER=`cat ./feeds.conf.default | grep "src-git packages" | awk -F ";openwrt" '{print $2}'`

	if [ -z ${OPENWRT_VER} ]; then
		OPENWRT_VER=`cat ./feeds.conf.default | grep "src-git-full packages" | awk -F ";openwrt" '{print $2}'`
	fi
fi

if [ -z ${1} ]; then
        MTK_FEEDS_DIR=feeds/mtk_openwrt_feed
fi

_remove_patches(){
	format="(%-8s) [%-60.60s] "
	aa1="$1"
	aa2="$2"

	if [ "$aa1" = "path" ]; then
		echo "rm '$aa2'"
		rm -f ./$aa2
	fi

	if [ "$aa1" = "subject" ]; then
		patch_list=()
		path="target/linux"
		for patch in $(grep -r $path -e '^Subject:' | grep -E "$aa2" | \
			       awk '{split($0,arr,":"); print arr[1]}')
		do
			if [[ ! " ${patch_list[@]} " =~ " $patch" ]]; then
				if [ -f ./$patch ]; then
					match=$(grep "Subject" $patch | head -1 )
					printf "$format " "$aa1" "$match"; echo ""
					echo "rm '$patch'"
					rm -f ./$patch
				fi
				patch_list+=("$patch")
			fi
		done
	fi

	if [ "$aa1" = "file" ] || [ "$aa1" = "filename" ]; then
		patch_list=()
		for patch in `grep -r 'target/linux' -e '^---\ a/' | grep -E "$aa2" | \
                            awk '{split($0,arr,":"); print arr[1]}'`
		do
			if [[ ! " ${patch_list[@]} " =~ " $patch" ]]; then
				if [ -f ./$patch ]; then
					msg=$(grep -e "^---\ a/" $patch | grep -E "$aa2" | head -1)
					printf "$format" "$aa1" "$msg"; echo ""
					echo "rm '$patch'"
					rm -f ./$patch
				fi
				patch_list+=("$patch")
			fi
		done
	fi
}

remove_patches(){
	echo "remove conflict patches"
	f=${MTK_FEEDS_DIR}/remove.patch.list
	result=$(awk '/^\[/ { S=substr($0,2,length-2) } $0 !~ /^\[/ { print S "@@" $0 }' ${f})

	while IFS= read -r aa; do
		aa1=`echo $aa | awk '{split($0,arr,"@@"); print arr[1]}'`
		aa2=`echo $aa | awk '{split($0,arr,"@@"); print arr[2]}'`
		if [[ $aa2 != \#* ]]; then
			_remove_patches "$aa1" "$aa2"
		fi
	done <<< "$result"
}

sdk_patch(){
	files=`find ${MTK_FEEDS_DIR}/openwrt_patches${OPENWRT_VER} -name "*.patch" | sort`
	for file in $files
	do
		patch -f -p1 -i ${file} || exit 1
	done
}

sdk_patch
#cp mtk target to OpenWRT
cp -fpR ${MTK_FEEDS_DIR}/target ./
cp -fpR ${MTK_FEEDS_DIR}/package${OPENWRT_VER}/* ./package
cp -fpR ${MTK_FEEDS_DIR}/tools ./
#remove patch if choose to not "keep" patch
if [ -z ${2} ]; then
	remove_patches
fi

