module("luci.controller.admin.system", package.seeall)

function index()
    -- menu.d/luci-base.json에 이미 정의되어 있으므로 entry() 불필요
end

function action_change_password()
    local sys = require "luci.sys"
    local http = require "luci.http"
    local template = require "luci.template"
    local dispatcher = require "luci.dispatcher"
    
    if http.getenv("REQUEST_METHOD") == "POST" then
        local current = http.formvalue("current_password")
        local new = http.formvalue("new_password")
        local confirm = http.formvalue("confirm_password")
        
        if current and new and confirm then
            if new == confirm then
                if sys.user.checkpasswd("doowon", current) then
                    sys.user.setpasswd("doowon", new)
                    http.redirect(dispatcher.build_url("admin"))
                    return
                end
            end
        end
        
        -- 실패 시 에러 메시지와 함께 폼 다시 표시
        template.render("admin/changepassword", {
            error = true,
            message = "Password change failed. Please check your inputs."
        })
    else
        -- GET 요청 시 패스워드 변경 폼 표시
        template.render("admin/changepassword", {
            error = false,
            message = ""
        })
    end
end 