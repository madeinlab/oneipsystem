#!/bin/bash

# Get ethaddr by nanddump
dump_ethaddr=$(nanddump /dev/mtd2 2>/dev/null | grep '^ethaddr')
ethaddr=${dump_ethaddr#*ethaddr=}
ethaddr=${ethaddr%% *}
ethaddr1=${dump_ethaddr#*ethaddr1=}

# Converter ':' to space
# e.g.: 1C:56:8E:2F:E4:EE -> 1C 56 8E 2F E4 EE
lan_mac=${ethaddr//:/ }
wan_mac=${ethaddr1//:/ }

# Set WAN/LAN MAC address by mtk_factory_rw.sh
echo "Setting LAN MAC address: $lan_mac"
/sbin/mtk_factory_rw.sh -w lan $lan_mac

echo "Setting WAN MAC address: $wan_mac"
/sbin/mtk_factory_rw.sh -w wan $wan_mac

