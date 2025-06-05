#!/usr/bin/env lua

local nixio = require("nixio")
local uci_ip = arg[1]
local mac = arg[2]
mac = string.lower(mac)
local accounts_path = "/etc/camera/accounts.json"

local debug = false
local function debug_log(level, msg)
	if debug and nixio and nixio.syslog then
		nixio.syslog(level, msg)
	end
end

debug_log("debug", string.format("reboot-camera.lua ip[%s] mac[%s]", uci_ip, mac))

if not uci_ip or uci_ip == "" then
    print("Missing CAMERA_IP")
    debug_log("err", "reboot-camera.lua Missing CAMERA_IP")
    os.exit(1)
end

local username = ""
local password = ""
local decpass = ""

if mac and mac ~= "" then
    local fs = require("nixio.fs")
    local json = require("luci.jsonc")
    if fs.access(accounts_path) then
        debug_log("debug", "reboot-camera.lua access  /etc/camera/accounts.json")
        local content = fs.readfile(accounts_path)
        local data = json.parse(content)
        local acc = data and data[mac]
        if acc then
            username = acc.username or ""
            password = acc.password or ""
        end
    end
    debug_log("debug", "username: " .. username .. " password:" .. password)

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

debug_log("debug", "cmd:" .. cmd)
local ret = os.execute(cmd)
if ret == 0 then
    nixio.syslog("info", string.format("[Camera] Reboot [%s][%s]", uci_ip, mac))
end

local pidFile = io.open(tmpfile, "r")
local pid = pidFile and pidFile:read("*n")
if pidFile then pidFile:close() end
os.execute("rm -f " .. tmpfile)

if not pid then
    print("Failed to retrieve PID")
    os.exit(1)
end

debug_log("debug", "pid:" .. pid)

os.execute("sleep 2")
local check = os.execute("ps -p " .. pid .. " > /dev/null")

if check == 0 then
    print("onvif-util is still running, killing process...")
    os.execute("kill -9 " .. pid)
else
    print("onvif-util completed within timeout.")
end
