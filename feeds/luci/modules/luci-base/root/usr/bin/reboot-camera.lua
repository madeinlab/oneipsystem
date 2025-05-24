#!/usr/bin/env lua

local nixio = require("nixio")
local uci_ip = arg[1]
local mac = arg[2]
mac = string.lower(mac)
local accounts_path = "/etc/camera/accounts.json"

nixio.syslog("debug", string.format("reboot-camera.lua ip[%s] mac[%s]", uci_ip, mac))

if not uci_ip or uci_ip == "" then
    print("Missing CAMERA_IP")
    nixio.syslog("err", "reboot-camera.lua Missing CAMERA_IP")
    os.exit(1)
end

local username = ""
local password = ""
local decpass = ""

-- 계정 정보 조회
if mac and mac ~= "" then
    local fs = require("nixio.fs")
    local json = require("luci.jsonc")
    if fs.access(accounts_path) then
        -- nixio.syslog("debug", "reboot-camera.lua access  /etc/camera/accounts.json")
        local content = fs.readfile(accounts_path)
        local data = json.parse(content)
        local acc = data and data[mac]
        if acc then
            username = acc.username or ""
            password = acc.password or ""
        end
    end
    -- nixio.syslog("debug", "username: " .. username .. " password:" .. password)

    if password and password ~= "" then
        local f = io.popen("luajit /usr/lib/key_manager.lua decrypt " .. password)
        decpass = f:read("*a"):gsub("^%s+", ""):gsub("%s+$", "")
        f:close()
    end
end

local tmpfile = "/tmp/onvif-pid.txt"
local cmd
if username and decpass then
    cmd = string.format('sh -c \'onvif-util -r -u "%s" -p "%s" "%s" & echo $! > %s\'', username, decpass, uci_ip, tmpfile)
else
    cmd = string.format('sh -c \'onvif-util -r "%s" & echo $! > %s\'', uci_ip, tmpfile)
end

-- nixio.syslog("debug", "cmd:" .. cmd)
os.execute(cmd)

local pidFile = io.open(tmpfile, "r")
local pid = pidFile and pidFile:read("*n")
if pidFile then pidFile:close() end
os.execute("rm -f " .. tmpfile)

if not pid then
    print("Failed to retrieve PID")
    os.exit(1)
end

-- nixio.syslog("debug", "pid:" .. pid)

os.execute("sleep 2")
local check = os.execute("ps -p " .. pid .. " > /dev/null")

if check == 0 then
    print("onvif-util is still running, killing process...")
    os.execute("kill -9 " .. pid)
else
    print("onvif-util completed within timeout.")
end
