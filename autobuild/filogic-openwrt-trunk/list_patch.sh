#!/bin/bash

format="(%-8s) [%-60.60s] "

list_patches(){
	aa1="$1"
	aa2="$2"

	if [ "$aa1" = "path" ]; then
  		if [ -f ./$aa2 ]; then
			ls ./$aa2
		fi
  		if [ -f ../mtk-openwrt-feeds/$aa2 ]; then
			ls ../mtk-openwrt-feeds/$aa2
		fi
	fi

	if [ "$aa1" = "keyword" ]; then
		for aaa in `grep -rl 'target/linux' -e $aa2`
		do
			if [ ${aaa##*\.} = "patch" ] || [ ${aaa##*\.} = "diff" ]; then
				printf "$format" "$aa1" "$aa2"; ls ./$aaa 2>null
			fi
		done
		for aaa in `grep -rl '../mtk-openwrt-feeds/target/linux' -e $aa2`
		do
			if [ ${aaa##*\.} = "patch" ] || [ ${aaa##*\.} = "diff" ]; then
				printf "$format" "$aa1" "$aa2"; ls ./$aaa 2>null
			fi
		done
	fi

	if [ "$aa1" = "subject" ]; then
		patch_list=()
		path="target/linux"
		for patch in $(grep -r $path -e '^Subject:' | grep -E "$aa2" | \
			       awk '{split($0,arr,":"); print arr[1]}')
		do
			if [[ ! " ${patch_list[@]} " =~ " $patch" ]]; then
				match=$(grep "Subject" $patch | head -1 )
				printf "$format " "$aa1" "$match"; ls $patch 2>null
				patch_list+=("$patch")
			fi
		done
		path="../mtk-openwrt-feeds/target/linux"
		for patch in $(grep -r $path -e '^Subject:' | grep -E "$aa2" | \
			       awk '{split($0,arr,":"); print arr[1]}')
		do
			if [[ ! " ${patch_list[@]} " =~ " $patch" ]]; then
				match=$(grep "Subject" $patch | head -1 )
				printf "$format " "$aa1" "$match"; ls $patch 2>null
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
				msg=$(grep -e "^---\ a/" $patch | grep -E "$aa2" | head -1)
				printf "$format" "$aa1" "$msg"; ls ./$patch 2>null
				patch_list+=("$patch")
			fi
		done
		for patch in `grep -r '../mtk-openwrt-feeds/target/linux' -e '^---\ a/' | \
                            grep -E "$aa2" | \
                            awk '{split($0,arr,":"); print arr[1]}'`
		do
			if [[ ! " ${patch_list[@]} " =~ " $patch" ]]; then
				msg=$(grep -e "^---\ a/" $patch | grep -E "$aa2" | head -1)
				printf "$format" "$aa1" "$msg"; ls ./$patch 2>null
				patch_list+=("$patch")
			fi
		done
	fi
}

if [ $# = 1 ]; then
	f=$1
	result=$(awk '/^\[/ { S=substr($0,2,length-2) } $0 !~ /^\[/ { print S "@@" $0 }' ${f})

	while IFS= read -r aa; do
		aa1=`echo $aa | awk '{split($0,arr,"@@"); print arr[1]}'`
		aa2=`echo $aa | awk '{split($0,arr,"@@"); print arr[2]}'`
		if [ "$aa2" != "" ]; then
			if [[ $aa2 != \#* ]]; then
				list_patches "$aa1" "$aa2"
			fi
		fi
	done <<< "$result"
else
	if [ "$2" != "" ]; then
		list_patches "$1" "$2"
	fi
fi
