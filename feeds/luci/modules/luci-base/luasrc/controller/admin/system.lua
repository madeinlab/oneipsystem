sys = require "luci.sys"
http = require "luci.http"
util = require "luci.util"
fs = require "nixio.fs"
uci = require("luci.model.uci").cursor()
nixio = require "nixio", require "nixio.util"
json = require "luci.jsonc"

module("luci.controller.admin.system", package.seeall)

function index()
    entry({"admin", "system", "password_rules", "get"}, call("get_password_rules")).leaf = true
    entry({"admin", "system", "set", "model"}, call("set_model_name")).leaf = true
end

function action_change_password()
    local sys = require "luci.sys"
    local http = require "luci.http"
    local template = require "luci.template"
    local dispatcher = require "luci.dispatcher"
    local nixio = require "nixio"
    local util = require "luci.util"
    local i18n = require "luci.i18n"

	if dispatcher.context and dispatcher.context.authuser then
		username = dispatcher.context.authuser
	-- 	nixio.syslog("info", "Found authenticated user [MASKED]")
	-- else
	-- 	nixio.syslog("info", "No username found in template context")
	end
    if http.getenv("REQUEST_METHOD") == "POST" then
        local current = http.formvalue("current_password")
        local new = http.formvalue("new_password")
        local confirm = http.formvalue("confirm_password")
        
        if current and new and confirm then
            if new == confirm then
                -- nixio.syslog("info", "Password confirmation matches")

                if username then
                    -- nixio.syslog("info", "Verifying current password")
                    if sys.user.checkpasswd(username, current) then
                        -- nixio.syslog("info", "Current password verification successful")

                        if sys.user.setpasswd(username, new) then
                            -- nixio.syslog("info", "Password changed successfully")

                            template.render("admin/changepassword", {
                                success = true,
                                error = false,
                                message = i18n.translate("Password changed successfully. Please log in with your new password."),
                                redirect = true,
                                debug_info = debug_info
                            })
                            return
                        else
                            -- nixio.syslog("err", "Failed to set new password")
                        end
                    else
                        -- nixio.syslog("warning", "Password verification failed")
                    end
                else
                    -- nixio.syslog("err", "Authentication required")
                end
            else
                -- nixio.syslog("warning", "Password confirmation mismatch")
            end
        else
            -- nixio.syslog("warning", "Missing required fields")
        end
        
        -- 실패 시 에러 메시지와 함께 폼 다시 표시
        template.render("admin/changepassword", {
            success = false,
            error = true,
            message = i18n.translate("Password change failed. Please check your inputs."),
            redirect = false,
            debug_info = debug_info
        })
    else
        template.render("admin/changepassword", {
            success = false,
            error = false,
            message = "",
            redirect = false,
            debug_info = debug_info
        })
    end
end

function get_password_rules()
    local first_section = nil 
    uci:foreach("admin_manage", "password_rule", function(section)
        if not first_section then
            first_section = section
            return false
        end
    end)

    if first_section then
        local section_name = first_section[".name"]

        -- UCI에서 값 읽기
        local min_length = uci:get('admin_manage', section_name, 'min_length') or "9"
        local max_length = uci:get('admin_manage', section_name, 'max_length') or "32"
        local check_sequential = uci:get('admin_manage', section_name, 'check_sequential') or "0"
        local check_sequential_ignore_case = uci:get('admin_manage', section_name, 'check_sequential_ignore_case') or "0"
        local check_sequential_special = uci:get('admin_manage', section_name, 'check_sequential_special') or "0"

        -- JSON 반환
        luci.http.prepare_content("application/json")
        luci.http.write(json.stringify({
            minLength = tonumber(min_length),
            maxLength = tonumber(max_length),
            checkSequential = check_sequential,
            checkSequentialIgnoreCase = check_sequential_ignore_case,
            checkSequentialSpecial = check_sequential_special
        }))
    end

    -- nixio.syslog("err", "No password_rule section found in uci")
    return
end

-- https://192.168.1.100/cgi-bin/luci/admin/system/set/model?model_name=modelname
function set_model_name()
    -- nixio.syslog("debug", "set_model_name()")

    -- URL 파라미터에서 모델명 가져오기
    local model_name = luci.http.formvalue("model_name")

    if not model_name or model_name == "" then
        -- nixio.syslog("debug", "set_model_name() failed: No model name provided")
        luci.http.status(400, "Model name not provided")
        return  -- 400 에러 후 함수 종료
    end

    uci:set("system", "@system[0]", "model", model_name)
    uci:commit("system")
    luci.sys.exec("/etc/init.d/system reload")  -- 모델명 변경 적용

    -- 성공 응답 반환
    luci.http.prepare_content("application/json")
    luci.http.write(json.stringify({success = true, model_name = model_name}))
end