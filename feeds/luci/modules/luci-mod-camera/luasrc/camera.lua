-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Licensed to the public under the Apache License 2.0.

sys = require "luci.sys"
http = require "luci.http"
util = require "luci.util"
fs   = require "nixio.fs"
uci = require("luci.model.uci").cursor()
nixio = require "nixio", require "nixio.util"

module("luci.camera", package.seeall)

local HLS_PORT_OFFSET = 50000

local camera_dump_path = "/etc/cameras"
local config_file_path = "/etc/config"
local config_file = "camera"	-- /etc/config/camera
local config_section_type = "camera"
local account = ""
local accountPW = ""

function get_ip_address(intf)
	res = sys.exec("/sbin/ifconfig " .. intf .. " | awk -F ' *|:' '/inet addr/{print $4}'")
	-- remove line feed
	retVal = util.split(res, "\n")
	return retVal[1]
end

function cam1_redirect()
	local rv
	local port = "8081"
	local wanIP = get_ip_address("eth1")
	local intfIP = get_ip_address("eth0.1")
	local ip8 = util.split(intfIP,".")
	res = sys.exec("/sbin/check_socat.sh " .. port)
	rv = util.split(res, "\n")
	if(rv[1] ~= "0") then
		sys.exec("socat TCP-LISTEN:" .. port .. ",fork,reuseaddr TCP:" .. ip8[1] .. "." .. ip8[2] .. "." .. ip8[3] .. "." .. "10:443 & > /dev/null")
	end
	http.redirect("https://" .. wanIP .. ":" .. port)
end

function cam2_redirect()
	local rv
	local port = "8082"
	local wanIP = get_ip_address("eth1")
	local intfIP = get_ip_address("eth0.2")
	local ip8 = util.split(intfIP,".")
	res = sys.exec("/sbin/check_socat.sh " .. port)
	rv = util.split(res, "\n")
	if(rv[1] ~= "0") then
		sys.exec("socat TCP-LISTEN:" .. port .. ",fork,reuseaddr TCP:" .. ip8[1] .. "." .. ip8[2] .. "." .. ip8[3] .. "." .. "10:443 & > /dev/null")
	end
	http.redirect("https://" .. wanIP .. ":" .. port)
end

function cam3_redirect()
	local rv
	local port = "8083"
	local wanIP = get_ip_address("eth1")
	local intfIP = get_ip_address("eth0.3")
	local ip8 = util.split(intfIP,".")
	res = sys.exec("/sbin/check_socat.sh " .. port)
	rv = util.split(res, "\n")
	if(rv[1] ~= "0") then
		sys.exec("socat TCP-LISTEN:" .. port .. ",fork,reuseaddr TCP:" .. ip8[1] .. "." .. ip8[2] .. "." .. ip8[3] .. "." .. "10:443 & > /dev/null")
	end
	http.redirect("https://" .. wanIP .. ":" .. port)
end

function cam4_redirect()
	local rv
	local port = "8084"
	local wanIP = get_ip_address("eth1")
	local intfIP = get_ip_address("eth0.4")
	local ip8 = util.split(intfIP,".")
	res = sys.exec("/sbin/check_socat.sh " .. port)
	rv = util.split(res, "\n")
	if(rv[1] ~= "0") then
		sys.exec("socat TCP-LISTEN:" .. port .. ",fork,reuseaddr TCP:" .. ip8[1] .. "." .. ip8[2] .. "." .. ip8[3] .. "." .. "10:443 & > /dev/null")
	end
	http.redirect("https://" .. wanIP .. ":" .. port)
end

function cam5_redirect()
	local rv
	local port = "8085"
	local wanIP = get_ip_address("eth1")
	local intfIP = get_ip_address("eth0.5")
	local ip8 = util.split(intfIP,".")
	res = sys.exec("/sbin/check_socat.sh " .. port)
	rv = util.split(res, "\n")
	if(rv[1] ~= "0") then
		sys.exec("socat TCP-LISTEN:" .. port .. ",fork,reuseaddr TCP:" .. ip8[1] .. "." .. ip8[2] .. "." .. ip8[3] .. "." .. "10:443 & > /dev/null")
	end
	http.redirect("https://" .. wanIP .. ":" .. port)
end

function cam6_redirect()
	local rv
	local port = "8086"
	local wanIP = get_ip_address("eth1")
	local intfIP = get_ip_address("eth0.6")
	local ip8 = util.split(intfIP,".")
	res = sys.exec("/sbin/check_socat.sh " .. port)
	rv = util.split(res, "\n")
	if(rv[1] ~= "0") then
		sys.exec("socat TCP-LISTEN:" .. port .. ",fork,reuseaddr TCP:" .. ip8[1] .. "." .. ip8[2] .. "." .. ip8[3] .. "." .. "10:443 & > /dev/null")
	end
	http.redirect("https://" .. wanIP .. ":" .. port)
end

function etc1_redirect()
    local dsp = require "luci.dispatcher"
    local utl = require "luci.util"

    local acls = utl.ubus("session", "access", { ubus_rpc_session = http.getcookie("sysauth") })
    local menu = dsp.menu_json(acls or {}) or {}

    http.prepare_content("application/json")
    http.write_json(menu)
end

function etc2_redirect()
    local parser = require "luci.jsonc".new()

    luci.http.context.request:setfilehandler(function(_, s)
        if not s then
            return nil
        end

        local ok, err = parser:parse(s)
        return (not err or nil)
    end)

    luci.http.context.request:content()

    local json = parser:get()
    if json == nil or type(json) ~= "table" then
        luci.http.prepare_content("application/json")
        luci.http.write_json(ubus_reply(nil, nil, -32700, "Parse error"))
        return
    end

    local response
    if #json == 0 then
        response = ubus_request(json)
    else
        response = {}

        local _, request
        for _, request in ipairs(json) do
            response[_] = ubus_request(request)
        end
    end

    luci.http.prepare_content("application/json")
    luci.http.write_json(response)
end

function cameraRedirect(ip, port)
	-- nixio.syslog("debug", "cameraRedirect() " .. ip .. " " .. port)
    if ip == "" or ip == nil or port == "" or port == nil then
        -- nixio.syslog("debug", "cameraRedirect: ip or port is empty or nil.")
        return false
    end

	local rv
	local wanIP = get_ip_address("eth1")	
	sys.exec("chmod +x /sbin/check_socat.sh")
	res = sys.exec("/sbin/check_socat.sh " .. port)
	rv = util.split(res, "\n")
	if(rv[1] ~= "0") then
		local cmd = "socat TCP-LISTEN:" .. port .. ",fork,reuseaddr TCP:" .. ip .. ":443 & > /dev/null"
		-- nixio.syslog("debug", "cameraRedirect() " .. cmd)
		sys.exec(cmd)		
	end

	return
	-- handled on the web
	--http.redirect("https://" .. wanIP .. ":" .. port)	
end

function rtspRedirect(url, port)
	-- nixio.syslog("debug", "rtspRedirect() " .. url .. " " .. port)
	if url == "" or url == nil or port == "" or port == nil then
        -- nixio.syslog("debug", "rtspRedirect: url or port is empty or nil.")
        return false
    end

	local rv
	local wanIP = get_ip_address("eth1")
	local removedUrl = string.sub(url, 8)
	sys.exec("chmod +x /sbin/check_socat.sh")
	res = sys.exec("/sbin/check_socat.sh " .. port)
	rv = util.split(res, "\n")
	if(rv[1] ~= "0") then
		local cmd = "socat TCP-LISTEN:" .. port .. ",fork,reuseaddr TCP:" .. removedUrl .. " & > /dev/null"
		-- nixio.syslog("debug", "rtspRedirect() " .. cmd)
		sys.exec(cmd)
	end
	
	return
	-- handled on the web
	--http.redirect("https://" .. wanIP .. ":" .. port)
end

function getCameraInfo(section_id, type)
	-- nixio.syslog("debug", "getCameraInfo() " .. section_id .. " " .. type)
	
	local wanip = uci:get('network', 'wan', 'ipaddr')
	local portKey = (type == 'webpage') and 'httpForwardingPort' or 'rtspForwardingPort'
	local port = uci:get('camera', section_id, portKey)
	
	port = tonumber(port)
	if port and type == 'streaming' then
		port = port + HLS_PORT_OFFSET
	end
	
	return { wanip = wanip, port = port }
end

function initCameraConfig()
	-- nixio.syslog("debug", "initCameraConfig()")

	-- Search connected cameras
	local cameraIP = searchConnectedCamera()

	-- Generate dump file
	createCameraDumpFiles(cameraIP)

	-- Generate camera config file
	createCameraConfigFile()
end

-- Search connected cameras
function searchConnectedCamera()
	-- nixio.syslog("debug", "searchConnectedCamera()")

	local result = sys.exec("onvif-util -a")

	local lines = {}
    for line in result:gmatch("([^\r\n]+)") do
        table.insert(lines, line)
    end

	if #lines < 2 then
        return nil
    end

	local secondLine = {}
    for word in lines[2]:gmatch("%S+") do
        table.insert(secondLine, word)
    end

	if #secondLine ~= 3 then
        return nil
    end

	local count = tonumber(secondLine[2])
    if count == nil then
        return nil
    end
	
	local offset = 2
	local cameraIP = {}
	for i = 1, count do
        local part = {}
        for word in lines[offset + i]:gmatch("%S+") do
            table.insert(part, word)
        end

		local ip = part[1]:gsub("^%s*(.-)%s*$", "%1")
		table.insert(cameraIP, ip)
	end	

	return cameraIP
end

-- Generate dump files
function createCameraDumpFiles(info)
	-- nixio.syslog("debug", "createCameraDumpFiles()")	
    -- Create the directory if it doesn't exist
    sys.exec("mkdir -p " .. camera_dump_path)

	-- Iterate over the info array
	for i, ip in ipairs(info) do
		local filepath = camera_dump_path .. "/cam" .. i
		--local cmd = string.format("onvif-util -d -u %s -p %s %s > %s", account, accountPW, ip, filepath)
		local cmd = string.format("onvif-util -d %s > %s", ip, filepath)
		sys.exec(cmd)
	end
end

-- Generate dump file
function createCameraDumpFile(ip, filename)
	--local cmd = string.format("onvif-util -d -u %s -p %s %s", account, accountPW, ip)
	local cmd = string.format("onvif-util -d %s", ip)
	local result = sys.exec(cmd)

	if result:find("%s*successfully connected to host") then
		-- nixio.syslog("info", "[createCameraDumpFile] Successfully connected to host: " .. ip)

    	-- Create the directory if it doesn't exist
    	sys.exec("mkdir -p " .. camera_dump_path)

		local path = camera_dump_path .. "/" .. filename
		local file = io.open(path, "w")
		if file then
			file:write(result)
			file:close()
			return true
		else
			-- nixio.syslog("err", "[createCameraDumpFile] Failed to open file for writing")
			return false
		end
	else
		-- nixio.syslog("err", "[createCameraDumpFile] Failed to connect to host: " .. ip)
		return false
	end
end

-- Generate camera config file
function createCameraConfigFile(dumpFilename)
	-- nixio.syslog("debug", "createCameraConfigFile()")		

	if not dumpFilename then
		local iter = fs.dir(camera_dump_path)
		if not iter then
			return nil
		end
	
		local bFirstFile = true
		for file in iter do
			local filepath = camera_dump_path  .. "/" .. file
			local camera_info = parseCameraFile(filepath)
			if camera_info then
				if bFirstFile then
					bFirstFile = false
					clear_uci_config_all(config_file, config_section_type)
				end
	
				write_to_uci_config(config_file, config_section_type, camera_info, file)
			end
		end
	else
		local filepath = camera_dump_path  .. "/" .. dumpFilename
		local camera_info = parseCameraFile(filepath)
		if camera_info and camera_info.ip ~= "" and camera_info.selectedrtsp ~= "" then
			write_to_uci_config(config_file, config_section_type, camera_info, dumpFilename)
		else
			-- nixio.syslog("debug", string.format("createCameraConfigFile: Camera information is not yet prepared."))
		end
	end

	return true
end

function addCamera(cameraIP)
	local portN = getChannel(cameraIP)
	if portN == nil then
		return
	end
	local filename = "cam" .. portN

	if findFile(camera_dump_path, filename) then
		-- Dump file exists
		-- nixio.syslog("debug", string.format("addCamera ip[%s] portN[%d] filename[%s]. Dump file exsits.", cameraIP, portN, filename))
	else
		-- nixio.syslog("debug", string.format("addCamera ip[%s] portN[%d] filename[%s]. Generate Dump file.", cameraIP, portN, filename))
		-- Generate dump file
		local result = createCameraDumpFile(cameraIP, filename)
		if not result then
			return false
		end

		-- Generate camera config file
		createCameraConfigFile(filename)
	end

	local filepath = camera_dump_path  .. "/" .. filename
	local camera_info = parseCameraFile(filepath)
	local webPort = createPortNum(filename, 'webpage')
	local rtspPort = createPortNum(filename, 'rtsp')
	
	-- Execute socat
	cameraRedirect(camera_info.ip, webPort)
	--rtspRedirect(camera_info.rtsp, rtspPort)	
end

function removeCamera(cameraIP)
	-- nixio.syslog("debug", string.format("removeCamera %s", cameraIP))

	local portN = getChannel(cameraIP)
	if portN == nil then
		return
	end

	-- remove dump file
	local filename = "cam" .. portN
	local filepath = camera_dump_path .. "/" .. filename
	sys.exec("rm -rf " .. filepath)

	-- remove config
	--clear_uci_config(config_file, config_section_type, filename)
	delete_uci_config_options(config_file, config_section_type, filename, {"ip", "manufacturer", "model", "httpForwardingPort", "rtspForwardingPort", "selectedrtsp", "profile", "rtsp"})

	return
end

function parse_equals_line(line)
    local key, value = line:match("^%s*([^=]+)%s*=%s*(.-)%s*$")
    key = key and key:match("^%s*(.-)%s*$")
    value = value and value:match("^%s*(.-)%s*$")
    return key, value
end

function parse_colon_line(line)
    local key, value = line:match("^%s*([^:]+)%s*:%s*(.-)%s*$")
    key = key and key:match("^%s*(.-)%s*$")
    value = value and value:match("^%s*(.-)%s*$")
    return key, value
end

function parseCameraFile(filepath)
	local file = io.open(filepath, "r")
	if not file then
        return nil, "Failed to open file: " .. filepath
    end

    local camera_info = {
        ip = "",
        manufacturer = "",
        model = "",
        selectedrtsp = "",
		profiles = {},
		rtsp = {}
    }

	for line in file:lines() do
		local trimmed_line = line:match("^%s*(.-)%s*$")

		local key, value
		-- host ip
		if trimmed_line:match("^found host") then
			key, value = parse_colon_line(trimmed_line)
			camera_info.ip = value
		-- manufacturer
		elseif trimmed_line:match("^Manufacturer") then
			key, value = parse_equals_line(trimmed_line)
			camera_info.manufacturer = value
		-- model
		elseif trimmed_line:match("^Model") then
			key, value = parse_equals_line(trimmed_line)
			camera_info.model = value
		-- default rtsp
		elseif trimmed_line:match("^MediaUri.Uri") then
			key, value = parse_equals_line(trimmed_line)
			camera_info.selectedrtsp = value
		-- profile
		elseif trimmed_line:match("^Profiles.Name") then
			key, value = parse_equals_line(trimmed_line)
			table.insert(camera_info.profiles, value)
		-- rtsp list
		elseif trimmed_line:match("^Rtsp.url") then
			key, value = parse_equals_line(trimmed_line)
			table.insert(camera_info.rtsp, value)				
		end 
	end

	file:close()
    return camera_info
end	

function delete_uci_config_options(config_file, config_section_type, config_section_name, options)
    -- Check if the section exists
    local section_found = false
    uci:foreach(config_file, config_section_type, function(section)
        if section['.name'] == config_section_name then
            section_found = true
            return false -- Exit loop
        end
    end)

    if section_found then
        -- Delete specified options from the section
        for _, option in ipairs(options) do
            uci:delete(config_file, config_section_name, option)
        end

        -- Commit the changes
		uci:save(config_file)
        uci:commit(config_file)
        -- nixio.syslog("debug", string.format("Deleted section '%s' from '%s'", config_section_name, config_file))
    else
		-- nixio.syslog("debug", string.format("Section '%s' not found in '%s'", config_section_name, config_file))
    end

	return;
end

function clear_uci_config(config_file, config_section_type, config_section_name)

	-- local result = uci:delete(config_file, config_section_type, config_section_name)
    -- if not result then
    --     return false, "Failed to delete all sections"
    -- end

	-- result = uci:save(config_file)
    -- if not result then
    --     return false, "Failed to save the config file"
    -- end

	-- result = uci:commit(config_file)
    -- if not result then
    --     return false, "Failed to commit the config file"
    -- end	

    -- Check if the section exists
    local section_found = false
    uci:foreach(config_file, config_section_type, function(section)
        if section['.name'] == config_section_name then
            section_found = true
            return false -- Exit loop
        end
    end)

    if section_found then
        -- Delete the section
        uci:delete(config_file, config_section_name)
        -- Commit the changes
		uci:save(config_file)
        uci:commit(config_file)
        -- nixio.syslog("debug", string.format("Deleted section '%s' from '%s'", config_section_name, config_file))
    else
		-- nixio.syslog("debug", string.format("Section '%s' not found in '%s'", config_section_name, config_file))
    end

	return;
end

function clear_uci_config_all(config_file, config_section_type)

	local result = uci:delete_all(config_file, config_section_type)
    if not result then
        return false, "Failed to delete all sections"
    end

	result = uci:save(config_file)
    if not result then
        return false, "Failed to save the config file"
    end

	result = uci:commit(config_file)
    if not result then
        return false, "Failed to commit the config file"
    end	

	return;
end

function write_to_uci_config(config_file, config_section_type, camera_info, section_id)

	-- sys.exec("touch /etc/config/camera")

	local webPort = createPortNum(section_id, 'webpage')
	local rtspPort = createPortNum(section_id, 'rtsp')

    local section_found = false
    uci:foreach(config_file, config_section_type, function(section)
        if section['.name'] == section_id then
            section_found = true
            return false -- Exit loop
        end
    end)
    
	-- Create new section 
	if not section_found then		
		uci:section(config_file, config_section_type, section_id, {})
		uci:save(config_file)
		uci:commit(config_file)
	end

	local match = section_id:match("%d+$")
	local switchPort = (match ~= nil) and tonumber(match) or 0 

	-- Set options
	uci:set(config_file, section_id, 'name', section_id)
	uci:set(config_file, section_id, 'switchPort', switchPort)
	uci:set(config_file, section_id, 'ip', camera_info.ip)
	uci:set(config_file, section_id, 'manufacturer', camera_info.manufacturer)
	uci:set(config_file, section_id, 'model', camera_info.model)
	uci:set(config_file, section_id, 'selectedrtsp', camera_info.selectedrtsp)
	uci:set(config_file, section_id, 'httpForwardingPort', webPort)
	uci:set(config_file, section_id, 'rtspForwardingPort', rtspPort)	
	uci:set_list(config_file, section_id, 'profile', camera_info.profiles)
	uci:set_list(config_file, section_id, 'rtsp', camera_info.rtsp)
	uci:save(config_file)
	uci:commit(config_file)

	return;
end

function createPortNum(section_id, type)
    local basePort = (type == 'webpage') and 8080 or 554
    
    local num = section_id:match("%d+")
    local port
    
    if num then
        num = tonumber(num)
        if type == 'webpage' then
            port = basePort + num
        else
            port = basePort + (1000 * num)
        end
    else
        port = basePort
    end
    
    return tostring(port)
end

function getChannel(cameraIP)
    local ip_parts = {}
    for part in string.gmatch(cameraIP, "([^.]+)") do
        table.insert(ip_parts, part)
    end

	-- nixio.syslog("debug", string.format("getChannel [%s] [%s] [%s] [%s]", ip_parts[1], ip_parts[2], ip_parts[3], ip_parts[4]))	

	local portN = tonumber(ip_parts[4])
    if portN == nil then
        return nil
    end

	if math.fmod(portN, 10) ~= 0 then
		return nil
	end

	-- nixio.syslog("debug", string.format("getChannel return: %d", math.floor(portN / 10)))	

	return math.floor(portN / 10)
end

function findFile(path, filename)
	local iter = fs.dir(path)
	if not iter then
		return nil
	end
		
	for file in iter do
		if file == filename then
			print("File found: " .. file)
			return true
		end
	end
	
	print("File not found: " .. filename)
	return false
end

function rebootCamera(section_id)
	-- nixio.syslog("debug", string.format("rebootCamera section_id[%s]", section_id))
	local cameraip = uci:get('camera', section_id, 'ip')
	if cameraip then
		--nixio.syslog("debug", string.format("rebootCamera section_id[%s]  001", section_id))
		sys.exec("/usr/lib/dnsmasq/reboot-camera.sh " .. cameraip)
		sys.exec("rm /etc/cameras/" .. section_id)
		uci:delete('camera', section_id, 'ip')
		uci:save('camera')
        uci:commit('camera')
		--nixio.syslog("debug", string.format("rebootCamera section_id[%s]  002", section_id))
	end
	--nixio.syslog("debug", string.format("rebootCamera section_id[%s]  003", section_id))
end

-- Get the port link state from /proc/rtk_gsw/link.
function getLinkState()
    local state = sys.exec("cat /proc/rtk_gsw/link")
    state = tostring(state):gsub("%s+", "")  -- 문자열 양옆 공백 제거
    --nixio.syslog("debug", string.format("getLinkState (type: %s): %s", type(state), state))
    return { result = state } 
end

function setCameraConfig(section, option, value)
	local cmd_set = string.format("uci set camera.%s.%s=%s", section, option, value)
	local cmd_commit = "uci commit camera"
	
	--nixio.syslog("debug", string.format("setCameraConfig %s", cmd_set))

	sys.exec(cmd_set)
	sys.exec(cmd_commit)
end
