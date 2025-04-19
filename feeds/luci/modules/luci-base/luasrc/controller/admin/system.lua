sys = require "luci.sys"
http = require "luci.http"
util = require "luci.util"
fs = require "nixio.fs"
uci = require("luci.model.uci").cursor()
nixio = require "nixio", require "nixio.util"
json = require "luci.jsonc"
dispatcher = require "luci.dispatcher"

module("luci.controller.admin.system", package.seeall)

-- build_url 함수 로컬 복사
local build_url = dispatcher.build_url

function verify_password(username, password, current_format, user_section)
    if current_format == "$p$" then
        return sys.user.checkpasswd(username, password)
    elseif current_format == "$6$" then
        -- 1. 저장된 해시값 가져오기
        local stored_hash = user_section.password:trim()
        nixio.syslog("debug", string.format("Stored hash from rpcd: %s", stored_hash))

        -- 2. 저장된 해시에서 salt 추출 ($6$salt$hash 형식)
        local salt = stored_hash:match("^%$6%$([^%$]+)%$")
        if not salt then
            nixio.syslog("err", "Failed to extract salt from stored hash")
            return false
        end
        nixio.syslog("debug", string.format("Extracted salt: %s", salt))

        -- 3. 추출한 salt로 현재 비밀번호의 해시값 생성
        local cmd = string.format('echo "%s" | openssl passwd -6 -salt "%s" -stdin', password, salt)
        nixio.syslog("debug", "Generating hash with extracted salt")
        local current_hash = sys.exec(cmd)
        if not current_hash then
            nixio.syslog("err", "Failed to generate hash for current password")
            return false
        end
        nixio.syslog("debug", string.format("Generated hash for verification: %s", current_hash:trim()))

        -- 4. 해시값 비교
        local result = (stored_hash == current_hash:trim())
        nixio.syslog("debug", string.format("Password verification result: %s", tostring(result)))
        return result
    end
    return false
end

function index()
    entry({"admin", "system", "password_rules", "get"}, call("get_password_rules")).leaf = true
    entry({"admin", "system", "set", "model"}, call("set_model_name")).leaf = true
    entry({"admin", "changepassword"}, call("action_change_password")).leaf = true
end

function action_change_password()
    local sys = require "luci.sys"
    local http = require "luci.http"
    local template = require "luci.template"
    local dispatcher = require "luci.dispatcher"
    local nixio = require "nixio"
    local util = require "luci.util"
    local i18n = require "luci.i18n"

    nixio.syslog("debug", "Password change attempt started")

    if dispatcher.context and dispatcher.context.authuser then
        username = dispatcher.context.authuser
        nixio.syslog("debug", string.format("Authenticated user: %s", username))
    else
        nixio.syslog("error", "No authenticated user found")
    end

    if http.getenv("REQUEST_METHOD") == "POST" then
        nixio.syslog("debug", "Processing POST request")
        local current = http.formvalue("current_password")
        local new = http.formvalue("new_password")
        local confirm = http.formvalue("confirm_password")
        
        if current and new and confirm then
            nixio.syslog("debug", "All password fields provided")
            if new == confirm then
                nixio.syslog("debug", "New passwords match")

                if username then
                    nixio.syslog("debug", string.format("Searching for user %s in rpcd config", username))
                    -- UCI 설정 디버그
                    local configs = uci:get_all("rpcd")
                    if configs then
                        nixio.syslog("debug", "Found rpcd config sections:")
                        for k, v in pairs(configs) do
                            nixio.syslog("debug", string.format("Section: %s, Type: %s", k, v[".type"] or "unknown"))
                            if v.username then
                                nixio.syslog("debug", string.format("Username in section: %s", v.username))
                            end
                        end
                    else
                        nixio.syslog("error", "No rpcd config sections found")
                    end

                    -- 현재 사용자의 패스워드 형식 확인
                    local user_section = nil
                    uci:foreach("rpcd", "login", function(s)
                        nixio.syslog("debug", string.format("Checking section: %s", s[".name"] or "unknown"))
                        if s.username == username then
                            user_section = s
                            nixio.syslog("debug", string.format("Found user section for %s", username))
                            return false
                        end
                    end)

                    if user_section then
                        local current_password = user_section.password
                        nixio.syslog("debug", string.format("Current password format: %s", current_password:sub(1,3)))
                        local success = false

                        -- 현재 비밀번호 검증
                        local password_format = current_password:sub(1, 3)
                        if verify_password(username, current, password_format, user_section) then
                            nixio.syslog("debug", "Current password verified successfully")

                            -- 패스워드 형식에 따른 처리
                            if password_format == "$p$" then
                                nixio.syslog("debug", "Updating password in /etc/shadow")
                                success = sys.user.setpasswd(username, new)
                                nixio.syslog("debug", string.format("Shadow update result: %s", tostring(success)))
                            elseif password_format == "$6$" then
                                nixio.syslog("debug", "Starting password change for $6$ format")
                                -- 새로운 비밀번호의 SHA-512 해시 생성 (기본 동작 - 랜덤 salt 사용)
                                local cmd = string.format('echo "%s" | openssl passwd -6 -stdin', new)
                                nixio.syslog("debug", "Executing openssl command for new password")
                                local new_hash = sys.exec(cmd)

                                if new_hash and new_hash:match("^%$6%$") then
                                    nixio.syslog("debug", string.format("Generated new hash: %s", new_hash:trim()))
                                    -- 새 해시값을 UCI에 저장
                                    local section_name = user_section[".name"]
                                    nixio.syslog("debug", string.format("Updating UCI section: %s", section_name))

                                    local set_result = uci:set("rpcd", section_name, "password", new_hash:trim())
                                    nixio.syslog("debug", string.format("UCI set result: %s", tostring(set_result)))

                                    success = uci:commit("rpcd")
                                    nixio.syslog("debug", string.format("UCI commit result: %s", tostring(success)))
                                else
                                    nixio.syslog("err", "Failed to generate valid SHA-512 hash")
                                end
                            else
                                nixio.syslog("err", string.format("Unknown password format: %s", password_format))
                            end
                        else
                            nixio.syslog("err", "Current password verification failed")
                        end

                        if success then
                            if current_password:sub(1, 3) == "$6$" then
                                sys.exec("/etc/init.d/rpcd reload")
                            end

                            -- 세션의 default_login_flag를 false로 업데이트
                            if dispatcher.context.authsession then
                                -- 세션 업데이트
                                util.ubus("session", "set", {
                                    ubus_rpc_session = dispatcher.context.authsession,
                                    values = {
                                        token = dispatcher.context.authtoken,
                                        default_login_flag = false
                                    }
                                })

                                -- 세션 종료
                                util.ubus("session", "destroy", {
                                    ubus_rpc_session = dispatcher.context.authsession
                                })

                                -- 쿠키 제거
                                http.header("Set-Cookie", "sysauth=; path=%s; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict; HttpOnly%s" %{
                                    build_url(), http.getenv("HTTPS") == "on" and "; secure" or ""
                                })
                            end

                            -- 로그인 페이지로 리다이렉트
                            http.redirect(build_url("admin/login"))
                            return
                        else
                            nixio.syslog("err", "Failed to set new password")
                        end
                    else
                        nixio.syslog("err", "Authentication required")
                    end
                else
                    nixio.syslog("warning", "Password confirmation mismatch")
                end
            else
                nixio.syslog("warning", "Missing required fields")
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
