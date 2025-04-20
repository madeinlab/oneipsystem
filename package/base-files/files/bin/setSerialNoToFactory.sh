#!/bin/bash

# Set Serial Number by mtk_factory_rw.sh
echo "Setting Serial Number"
/sbin/mtk_factory_rw.sh -w serial_no $serial_no

