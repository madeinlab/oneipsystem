module("luci.controller.admin.system", package.seeall)

function index()
    -- menu.d/luci-base.json에 이미 정의되어 있으므로 entry() 불필요
end

function action_change_password()
    local sys = require "luci.sys"
    local http = require "luci.http"
    local template = require "luci.template"
    local dispatcher = require "luci.dispatcher"
    local nixio = require "nixio"
    local util = require "luci.util"
    

	if dispatcher.context and dispatcher.context.authuser then
		username = dispatcher.context.authuser
		nixio.syslog("info", "Found authenticated user [MASKED]")
	else
		nixio.syslog("info", "No username found in template context")
	end
    if http.getenv("REQUEST_METHOD") == "POST" then
        local current = http.formvalue("current_password")
        local new = http.formvalue("new_password")
        local confirm = http.formvalue("confirm_password")
        
        if current and new and confirm then
            if new == confirm then
                nixio.syslog("info", "Password confirmation matches")

                if username then
                    nixio.syslog("info", "Verifying current password")
                    if sys.user.checkpasswd(username, current) then
                        nixio.syslog("info", "Current password verification successful")

                        if sys.user.setpasswd(username, new) then
                            nixio.syslog("info", "Password changed successfully")

                            template.render("admin/changepassword", {
                                success = true,
                                error = false,
                                message = "Password changed successfully. Please log in with your new password.",
                                redirect = true,
                                debug_info = debug_info
                            })
                            return
                        else
                            nixio.syslog("err", "Failed to set new password")
                        end
                    else
                        nixio.syslog("warning", "Password verification failed")
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
        
        -- 실패 시 에러 메시지와 함께 폼 다시 표시
        template.render("admin/changepassword", {
            success = false,
            error = true,
            message = "Password change failed. Please check your inputs.",
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
