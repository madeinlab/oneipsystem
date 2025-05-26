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

        -- 2. 저장된 해시에서 salt 추출 ($6$salt$hash 형식)
        local salt = stored_hash:match("^%$6%$([^%$]+)%$")
        if not salt then
            return false
        end

        -- 3. 추출한 salt로 현재 비밀번호의 해시값 생성
        local cmd = string.format('echo "%s" | openssl passwd -6 -salt "%s" -stdin', password, salt)
        local current_hash = sys.exec(cmd)
        if not current_hash then
            return false
        end

        -- 4. 해시값 비교
        local result = (stored_hash == current_hash:trim())
        return result
    end
    return false
end

function index()
    entry({"admin", "system", "password_rules", "get"}, call("get_password_rules")).leaf = true
    entry({"admin", "changepassword"}, call("action_change_password")).leaf = true
end

local function rsa_decrypt_base64_nofile(enc_base64)
    local privkey = "/etc/ssl/private.pem"
    local openssl_bin = "/usr/bin/openssl"
    local cmd = string.format("echo '%s' | %s base64 -d | %s rsautl -decrypt -inkey %s", enc_base64, openssl_bin, openssl_bin, privkey)
    local f = io.popen(cmd, "r")
    local decrypted = f:read("*a")
    f:close()
    if decrypted and #decrypted > 0 then
        return decrypted
    end
end

function action_change_password()
    local sys = require "luci.sys"
    local http = require "luci.http"
    local template = require "luci.template"
    local dispatcher = require "luci.dispatcher"
    local nixio = require "nixio"
    local util = require "luci.util"
    local i18n = require "luci.i18n"

    -- 최초 로그인 시에만 changepassword.htm 으로 이동. 그 외는 접근 금지.
    local first_login = uci:get("system", "@system[0]", "first_login") or "0"
    if first_login ~= "1" then
        http.status(403, "Forbidden")
        http.prepare_content("text/plain")
        http.write("Access denied")
        return
    end

    if dispatcher.context and dispatcher.context.authuser then
        username = dispatcher.context.authuser
    end

    if http.getenv("REQUEST_METHOD") == "POST" then
        local current = http.formvalue("current_password")
        local new = http.formvalue("new_password")
        local confirm = http.formvalue("confirm_password")
        
        -- RSA 복호화 시도
        local ok_cur, dec_current = pcall(rsa_decrypt_base64_nofile, current)
        local ok_new, dec_new = pcall(rsa_decrypt_base64_nofile, new)
        local ok_conf, dec_confirm = pcall(rsa_decrypt_base64_nofile, confirm)
        if not (ok_cur and dec_current and #dec_current > 0) then
            dec_current = nil
        end
        if not (ok_new and dec_new and #dec_new > 0) then
            dec_new = nil
        end
        if not (ok_conf and dec_confirm and #dec_confirm > 0) then
            dec_confirm = nil
        end
        current = dec_current
        new = dec_new
        confirm = dec_confirm
        if current and new and confirm then
            if new == confirm then
                if username then
                    -- 현재 사용자의 패스워드 형식 확인
                    local user_section = nil
                    uci:foreach("rpcd", "login", function(s)
                        if s.username == username then
                            user_section = s
                            return false
                        end
                    end)

                    if user_section then
                        local current_password = user_section.password
                        local success = false

                        -- 현재 비밀번호 검증
                        local password_format = current_password:sub(1, 3)
                        if verify_password(username, current, password_format, user_section) then
                            -- 패스워드 형식에 따른 처리
                            if password_format == "$p$" then
                                success = sys.user.setpasswd(username, new)
                            elseif password_format == "$6$" then
                                -- 새로운 비밀번호의 SHA-512 해시 생성 (기본 동작 - 랜덤 salt 사용)
                                local cmd = string.format('echo "%s" | openssl passwd -6 -stdin', new)
                                local new_hash = sys.exec(cmd)

                                if new_hash and new_hash:match("^%$6%$") then
                                    -- 새 해시값을 UCI에 저장
                                    local section_name = user_section[".name"]
                                    local set_result = uci:set("rpcd", section_name, "password", new_hash:trim())
                                    success = uci:commit("rpcd")
                                end
                            end
                        end

                        if success then
                            -- 최초 로그인 플래그 설정 (false)
                            local ok = uci:set("system", "@system[0]", "first_login", "0")
                            if ok then
                                local committed = uci:commit("system")
                                if committed then
                                    if current_password:sub(1, 3) == "$6$" then
                                        sys.exec("/etc/init.d/rpcd reload")
                                    end
                                end
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
                        end
                    end
                end
            end
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
    -- 인증 체크 추가
    if not luci.dispatcher.context.authsession then
        luci.http.status(403, "Forbidden")
        luci.http.prepare_content("application/json")
        luci.http.write_json({ error = "Authentication required" })
        return
    end

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
        luci.http.write_json({
            minLength = tonumber(min_length),
            maxLength = tonumber(max_length),
            checkSequential = check_sequential,
            checkSequentialIgnoreCase = check_sequential_ignore_case,
            checkSequentialSpecial = check_sequential_special
        })
    else
        -- 기본값 반환
        luci.http.prepare_content("application/json")
        luci.http.write_json({
            minLength = 9,
            maxLength = 32,
            checkSequential = "0",
            checkSequentialIgnoreCase = "0",
            checkSequentialSpecial = "0"
        })
    end
end

