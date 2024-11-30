-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Licensed to the public under the Apache License 2.0.

sys = require "luci.sys"
http = require "luci.http"
util = require "luci.util"

module("luci.camera", package.seeall)

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
	rv = sys.exec("ps aux | grep socat | grep :" .. port)
	if(rv == nil) then
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
	rv = sys.exec("ps aux | grep socat | grep :" .. port)
	if(rv == nil) then
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
	rv = sys.exec("ps aux | grep socat | grep :" .. port)
	if(rv == nil) then
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
	rv = sys.exec("ps aux | grep socat | grep :" .. port)
	if(rv == nil) then
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
	rv = sys.exec("ps aux | grep socat | grep :" .. port)
	if(rv == nil) then
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
	rv = sys.exec("ps aux | grep socat | grep :" .. port)
	if(rv == nil) then
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

