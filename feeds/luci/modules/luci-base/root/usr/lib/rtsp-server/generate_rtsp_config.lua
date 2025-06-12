#!/usr/bin/env lua

local function exec(cmd)
    local f = io.popen(cmd)
    local result = f:read("*a")
    f:close()
    return result
end

local function loadAccountsJson(path)
    local fs = require("nixio.fs")
    local json = require("luci.jsonc")

    if not fs.access(path) then return {} end

    local content = fs.readfile(path)
    local parsed = json.parse(content)

    return parsed or {}
end

local camlist_raw = exec("uci show camera | grep '=camera' | cut -d. -f2 | cut -d= -f1")
local camlist = {}
for cam in camlist_raw:gmatch("[^\r\n]+") do
    table.insert(camlist, cam)
end

local outfile = io.open("/usr/lib/rtsp-server/config.yml", "w")
outfile:write([[
rtmp: no    # disabled RTMP
webrtc: no  # disabeld WebRTC
srt: no     # disabeld SRT

# RTSP
rtsp: yes
rtspTransports: [tcp]
rtspEncryption: "no"
rtspAddress: :10554

# HLS
hls: yes
hlsAddress: :8888
hlsVariant: mpegts
hlsSegmentCount: 5
hlsSegmentDuration: 2s
hlsAlwaysRemux: yes
hlsDirectory: /tmp/hls
hlsAllowOrigin: '*'

readTimeout: 5s
writeTimeout: 5s
writeQueueSize: 128

paths:
]])

local nixio = require "nixio", require "nixio.util"
local accounts = loadAccountsJson("/etc/camera/accounts.json")

local debug = false
local function debug_log(level, msg)
	if debug and nixio and nixio.syslog then
		nixio.syslog(level, msg)
	end
end

for _, cam in ipairs(camlist) do
    local name = exec("uci get camera."..cam..".name"):gsub("%s+$", "")
    local ip = exec("uci get camera."..cam..".ip"):gsub("%s+$", "")
    local mac = exec("uci get camera."..cam..".mac"):gsub("%s+$", "")
    local username = ""
    local encpass = ""
    
    if accounts[mac] then
        username = accounts[mac].username or ""
        encpass = accounts[mac].password or ""
    end
    debug_log("debug", string.format("generate_rtsp_config name[%s] ip[%s] mac[%s] username[%s]", name, ip, mac, username))

    local rtsp_port = 554
    local profiles_raw = exec("uci get camera."..cam..".profile 2>/dev/null")
    local idx = name:match("cam(%d+)") or name

    local decpass
    if encpass and encpass ~= "" then
        local decpass_json = exec("ubus call luci decryptPassword '{ \"password\":\""..encpass.."\" }'")
        local json = require "luci.jsonc"
        local decpass_table = json.parse(decpass_json)
        decpass = decpass_table and decpass_table.result or ""

        if not decpass or decpass == "" then
            os.execute(string.format("logger -t mediamtx_setup 'Failed to decrypt password for camera.%s'", cam))
        end
    end

    for profile in profiles_raw:gmatch("[^%s]+") do
        local profnum = profile:match("(%d+)")
        local rtsp_path = string.format("media/1/%s/%s", profnum, profile)
        outfile:write(string.format('  "camera/%s/%s":\n', idx, profile))
        if decpass and decpass ~= "" then
            outfile:write(string.format('    source: "rtsp://%s:%s@%s:%s/%s"\n',
                username, decpass, ip, rtsp_port, rtsp_path))
        else
            outfile:write(string.format('    source: "rtsp://%s:%s/%s"\n',
                ip, rtsp_port, rtsp_path))
        end
        outfile:write('    sourceOnDemand: yes\n')
    end
end

outfile:close()

os.execute("chmod 600 /usr/lib/rtsp-server/config.yml")

print("OK")
