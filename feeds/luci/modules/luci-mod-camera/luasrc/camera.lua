-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Licensed to the public under the Apache License 2.0.

sys = require "luci.sys"
http = require "luci.http"
util = require "luci.util"
fs   = require "nixio.fs"
uci = require("luci.model.uci").cursor()
nixio = require "nixio", require "nixio.util"
jsonc = require "luci.jsonc"

module("luci.camera", package.seeall)

local HLS_PORT_OFFSET = 50000

local camera_dump_path = "/etc/camera"
local config_file_path = "/etc/config"
local config_file = "camera"	-- /etc/config/camera
local config_section_type = "camera"
local account_path = "/etc/camera/accounts.json"

-- Predefined IPs mapped to specific ports
local allowedIPs = {
	["209.142.67.10"] = 1, -- port 1
	["209.142.67.20"] = 2, -- port 2
	["209.142.67.30"] = 3, -- port 3
	["209.142.67.40"] = 4, -- port 4
	["209.142.67.50"] = 5, -- port 5
	["209.142.67.60"] = 6, -- port 6
	["209.142.67.70"] = 7, -- port 7
	["209.142.67.80"] = 8, -- port 8
}

-- Check if the given IP is one of the predefined allowed IPs
function getPortFromIP(ip)
	return allowedIPs[ip] or 0
end

function get_ip_address(intf)
	res = sys.exec("/sbin/ifconfig " .. intf .. " | awk -F ' *|:' '/inet addr/{print $4}'")
	-- remove line feed
	retVal = util.split(res, "\n")
	return retVal[1]
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

-- not used
-- function initCameraConfig()
-- 	-- nixio.syslog("debug", "initCameraConfig()")

-- 	-- Search connected camera
-- 	local cameraIP = searchConnectedCamera()

-- 	-- Generate dump file
-- 	createCameraDumpFiles(cameraIP)

-- 	-- Generate camera config file
-- 	createCameraConfigFile()
-- end

-- Search connected camera
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

-- not used
-- Generate dump files
-- function createCameraDumpFiles(info)
--     sys.exec("mkdir -p " .. camera_dump_path)

-- 	-- Iterate over the info array
-- 	for i, ip in ipairs(info) do
-- 		local section_id = "cam" .. (i + 1)
-- 		local filepath = camera_dump_path .. "/" .. section_id

-- 		local account = uci:get('camera', section_id, 'username') or ''		
-- 		local mac = uci:get('camera', section_id, 'mac') or ''
-- 		local password = ''

-- 		if mac ~= '' then
-- 			local acc, pw = getAccountByMac(mac)
-- 			if acc ~= '' and acc == account then
-- 				password = pw
-- 			end
-- 		end

-- 		local cmd
-- 		if account ~= '' and password ~= '' then
-- 			local decPw = decryptPassword(password)
-- 			if decPw ~= '' then
-- 				cmd = string.format("onvif-util -d -u '%s' -p '%s' '%s' > '%s'", account, decPw, ip, filepath)
-- 			else
-- 				cmd = string.format("onvif-util -d '%s' > '%s'", ip, filepath)
-- 			end			
-- 		else
-- 			cmd = string.format("onvif-util -d '%s' > '%s'", ip, filepath)
-- 		end

-- 		sys.exec(cmd)
-- 	end
-- end

-- Generate dump file
function createCameraDumpFile(filename, ip, mac, username, password)
	local user, pass = ''
	if (username or '') ~= '' and (password or '') ~= '' then
		user = username
		pass = password
	else
		if mac and mac ~= '' then
			user, pass = getAccountByMac(mac)
			user = user or ''
			pass = pass or ''			
		end
	end

	local cmd
	if user ~= '' and pass ~= '' then
		local decPass = decryptPassword(pass)
		if decPass ~= '' then
			cmd = string.format("onvif-util -d -u '%s' -p '%s' '%s'", user, decPass, ip)
		else
			nixio.syslog("err", string.format("[createCameraDumpFile] Password decryption failed for user: %s. Aborting.", user))
			return false
		end				
	else
		nixio.syslog("err", string.format("[createCameraDumpFile] No valid credentials found for ip: %s (mac: %s)", ip, mac or "nil"))
		cmd = string.format("onvif-util -d '%s'", ip)
	end

	local result = sys.exec(cmd)

	if result and result:match("successfully connected to host") then
    	-- Create the directory if it doesn't exist
    	sys.exec("mkdir -p " .. camera_dump_path)

		local path = camera_dump_path .. "/" .. filename
		local file, err = io.open(path, "w")
		if file then
			file:write(result)
			file:close()
			nixio.syslog("debug", string.format("[createCameraDumpFile] Dumpfile created successfully: %s", filename))
			return true
		else
			nixio.syslog("err", string.format("[createCameraDumpFile] Failed to write dump file: %s (%s)", path, err or "unknown error"))
			return false
		end
	else
		nixio.syslog("err", string.format("[createCameraDumpFile] Failed to connect to host: %s with user: %s", ip, user))
		return false
	end
end

-- Generate camera config file
function createCameraConfigFile(dumpFilename)
	-- nixio.syslog("debug", "createCameraConfigFile()")		

	if not dumpFilename then
		-- If dumpFilename is not provided, process all dump files

		local iter = fs.dir(camera_dump_path)
		if not iter then
			nixio.syslog("err", "[createCameraConfigFile] Failed to open camera dump directory")
			return nil
		end
	
		local isFirstValidCamera  = true
		for file in iter do
			local filepath = camera_dump_path  .. "/" .. file
			local camera_info = parseCameraFile(filepath)
			if camera_info then
				if isFirstValidCamera  then
					isFirstValidCamera  = false
					clear_uci_config_all(config_file, config_section_type)
				end
	
				local result = write_to_uci_config(config_file, config_section_type, camera_info)
				if not result then
					nixio.syslog("err", string.format("[createCameraConfigFile] Failed to write UCI config for %s", file))					
				end
			end
		end
	else
		-- If dumpFilename is provided, process only that specific file

		local filepath = camera_dump_path  .. "/" .. dumpFilename
		local camera_info = parseCameraFile(filepath)
		if camera_info and camera_info.ip ~= "" and camera_info.selectedrtsp ~= "" then
			local result = write_to_uci_config(config_file, config_section_type, camera_info)
			if not result then
				nixio.syslog("err", string.format("[createCameraConfigFile] Failed to write UCI config for %s", dumpFilename))
				return false
			end
		else
			nixio.syslog("err", string.format("[createCameraConfigFile] Invalid or incomplete camera info in %s", dumpFilename))
		end
	end

	nixio.syslog("debug", string.format("[createCameraConfigFile] Config 'camera' created successfully"))

	return true
end

function macToFilename(mac)
    local norm_mac = mac:lower():gsub(":", "")
    return norm_mac .. ".dump"
end

function isNonEmpty(str)
	return str ~= nil and str ~= ""
end

function addCamera(ip, mac, username, password)
	-- nixio.syslog("debug", string.format("[addCamera] ip[%s] mac[%s] username[%s] password[%s]", ip, mac, username, password))

	-- check ip
	local port = getPortFromIP(ip)
	if port == 0 then
		nixio.syslog("err", string.format("[addCamera] Invalid IP address: %s", ip))
		return false
	end

	if mac == nil or mac == '' then
		nixio.syslog("err", string.format("[addCamera] MAC address is nil or empty"))
		return false
	end

	local filename = macToFilename(mac)
	-- nixio.syslog("err", string.format("[addCamera] filename:%s", filename))
	local hasCredentials = isNonEmpty(username) and isNonEmpty(password)
	local result

	if hasCredentials then
		-- Called from web 'camera' page
		result = createCameraDumpFile(filename, ip, mac, username, password)
		if not result then
			nixio.syslog("err", string.format("[addCamera] Failed to create dump file"))
			return false
		end
	else
		if not findFile(camera_dump_path, filename) then
			result = createCameraDumpFile(filename, ip, mac)
			if not result then
				nixio.syslog("err", string.format("[addCamera] Failed to create dump file"))
				return false
			end			
		end
	end

	if result then
		-- Generate camera config file
		result = createCameraConfigFile(filename)
		if not result then
			nixio.syslog("err", string.format("[addCamera] Failed to create config file"))
			return false
		end

		local section_id = "cam" .. port		
		local webPort = createPortNum(section_id, 'webpage')
		local rtspPort = createPortNum(section_id, 'rtsp')
		
		-- Execute socat
		cameraRedirect(ip, webPort)
		-- rtspRedirect is disabled because RTSP port redirection is now handled via iptables, not socat
		-- rtspRedirect(camera_info.rtsp, rtspPort)

		-- Generates or updates the RTSP proxy server configuration file
		generateRtspProxyConf()
	end

	return true
end

function removeCamera(ip, mac)
	-- check ip
	local port = getPortFromIP(ip)
	if port == 0 then
		nixio.syslog("err", string.format("[removeCamera] Invalid IP address: %s", ip))
		return false
	end

	if mac == nil or mac == '' then
		nixio.syslog("err", string.format("[removeCamera] MAC address is nil or empty"))
		return false
	end

	-- remove dump file
	local filename = macToFilename(mac)	
	local filepath = camera_dump_path .. "/" .. filename
	sys.exec("rm -rf " .. filepath)

	-- remove config
	--clear_uci_config(config_file, config_section_type, filename)
	local section_id = "cam" .. port
	delete_uci_config_options(config_file, config_section_type, section_id, {"ip", "manufacturer", "model", "httpForwardingPort", "rtspForwardingPort", "selectedrtsp", "profile", "rtsp", "mac"})

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
		mac = "",
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
		-- mac
		elseif trimmed_line:match("HwAddress") then
			key, value = parse_equals_line(trimmed_line)
			camera_info.mac = string.lower(value)
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
	-- nixio.syslog("debug", "delete_uci_config_options")
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

function write_to_uci_config(config_file, config_section_type, camera_info)

	local port = getPortFromIP(camera_info.ip)
	if port == 0 then
		return false
	end

	local section_id = "cam" .. port

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

	-- Set options
	uci:set(config_file, section_id, 'name', section_id)
	uci:set(config_file, section_id, 'switchPort', port)
	uci:set(config_file, section_id, 'ip', camera_info.ip)
	uci:set(config_file, section_id, 'manufacturer', camera_info.manufacturer)
	uci:set(config_file, section_id, 'model', camera_info.model)
	uci:set(config_file, section_id, 'mac', camera_info.mac)
	uci:set(config_file, section_id, 'selectedrtsp', camera_info.selectedrtsp)
	uci:set(config_file, section_id, 'httpForwardingPort', webPort)
	uci:set(config_file, section_id, 'rtspForwardingPort', rtspPort)	
	uci:set_list(config_file, section_id, 'profile', camera_info.profiles)
	uci:set_list(config_file, section_id, 'rtsp', camera_info.rtsp)
	uci:save(config_file)
	uci:commit(config_file)

	return true;
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
			-- nixio.syslog("debug", "[findFile] File found: " .. file)
			return true
		end
	end
	
	-- nixio.syslog("debug", "[findFile] File not found: " .. filename)
	return false
end

function rebootCamera(ip, mac)
	nixio.syslog("debug", string.format("rebootCamera ip[%s] mac[%s]", ip, mac))
	sys.exec("/usr/bin/reboot-camera.lua " .. ip .. " " .. mac)
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

function decryptPassword(password)
    if password == "" then
        return ""
    end

	local safePassword = password:gsub("'", "'\\''")
    local cmd = string.format('/usr/bin/env luajit /usr/lib/key_manager.lua decrypt "%s"', safePassword)
    local handle = io.popen(cmd)
	if not handle then
		return ""
	end

    local res = handle:read("*a")
    handle:close()

	res = res:match("^%s*(.-)%s*$")  -- trim

	if res == "" or res:match("^ERROR") then
		return ""
	end

	return res
end

function updateAccountsConf()
	local accounts = {}
	local i = 0

	uci:foreach("camera", "camera", function(s)
		local flag = s.set_user
		local mac = s.mac
		local username = s.username
		local password = s.password

		if flag == "1" and password and password ~= "" then
			if mac and mac:match("^%x%x:%x%x:%x%x:%x%x:%x%x:%x%x$") and username ~= "" then
				accounts[mac:lower()] = {
					username = username,
					password = password
				}
				uci:delete("camera", s['.name'], "password")
			end
		end

		i = i + 1
	end)

	if next(accounts) ~= nil then
		local json_content = jsonc.stringify(accounts, true) .. "\n"
		fs.writefile(account_path, json_content)
	end

	uci:commit("camera")
	os.execute("chmod 600 " .. account_path)
end

function getAccountByMac(mac)
	local data = jsonc.parse(fs.readfile(account_path) or "{}")

	if not data or type(data) ~= "table" then
		return "", ""
	end

	local account = data[mac:lower()]
	if account then
		local username = account.username or ""
		local password = account.password or ""
		return username, password
	end

	return "", ""
end

function removeAccount(mac)
	local accounts = {}

	if fs.access(account_path) then
		local content = fs.readfile(account_path)
		if content and content ~= "" then
			accounts = jsonc.parse(content) or {}
		end
	end

	if accounts[mac] then
		accounts[mac] = nil

		local updated_content = jsonc.stringify(accounts, true)
		fs.writefile(account_path, updated_content)
		os.execute("chmod 600 " .. account_path)
	end
end

function getMacAddr() 
	local result = {}

	local f = io.open("/proc/rtk_gsw/mac", "r")
	if f then
		for line in f:lines() do
			local idx, mac = line:match("^(%d+)%s+([%x:]+)$")
			if idx and mac then
				result[idx] = mac
			end
		end
		f:close()
	end

	return result
end

-- Saves camera account information mapped to a MAC address
function saveAccountConf(mac, username, password)
	-- nixio.syslog("debug", string.format("saveAccountConf mac:%s)", mac))
    local accounts = {}
    local json_str = fs.readfile(account_path)

    if json_str and json_str ~= "" then
        accounts = jsonc.parse(json_str) or {}
    end

	local olduser = ""
	local oldpass = ""
	local newuser = username
	local newpass = password

	local norm_mac = mac:lower()
	if accounts[norm_mac] then
		olduser = accounts[norm_mac].username or ""
		oldpass = accounts[norm_mac].password or ""
	end

	local isPWMatch = isPasswordMatch(oldpass, newpass)

	if (olduser == newuser and isPWMatch == false) or (olduser ~= newuser) then
		accounts[norm_mac] = {
			username = newuser,
			password = newpass
		}

		local updated_json = jsonc.stringify(accounts, true)  -- true = pretty print
		fs.writefile(account_path, updated_json)
		os.execute("chmod 600 " .. account_path)

		nixio.syslog("debug", string.format("Account saved successfully (%s)", mac))
	end
end

-- Compares two encrypted passwords after decryption
function isPasswordMatch(pass1, pass2)
	local dec1 = decryptPassword(pass1)
	local dec2 = decryptPassword(pass2)
	return dec1 ~= "" and dec2 ~= "" and dec1 == dec2
end

-- Generates or updates the RTSP proxy server configuration file based on camera data
function generateRtspProxyConf()
	local result = sys.exec("/usr/lib/rtsp-server/generate_rtsp_config.lua")

	if result:match("OK") then
		os.execute("/etc/init.d/rtspproxy restart")
		nixio.syslog("debug", "RTSP configuration generated successfully")
		return { result = "RTSP configuration generated successfully." }
	else
		nixio.syslog("debug", "RTSP configuration generation failed.")
		return { error = "RTSP configuration generation failed." }
	end
end
