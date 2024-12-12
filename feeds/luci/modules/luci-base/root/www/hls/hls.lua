require "luci.http"
require "luci.sys"
require "nixio"
nixio = require "nixio", require "nixio.util"

function log_request(channel, request_url)
    os.execute("touch ")
    local log_file = io.open("/tmp/hls_requests.log", "a")
    local timestamp = os.time()
    log_file:write(string.format("%d %s %s\n", timestamp, channel, request_url))
    log_file:close()
end

-- 파일이 존재하는지 확인하는 함수
function is_file_exists(file_path)
    local file = io.open(file_path, "r")
    if file then
        file:close()
        return true
    else
        return false
    end
end

-- 디렉토리 내 파일 수를 세는 함수
function file_count_in_dir(dir)
    local cmd = "ls -l " .. dir .. " | wc -l"
    local handle = io.popen(cmd)
    local result = handle:read("*a")
    handle:close()
    return tonumber(result)
end

function execute_ffmpeg(channel, stream_url)
    --nixio.syslog("debug", "execute_ffmpeg started")
    os.execute("chmod +x /www/hls/start_ffmpeg.sh")
    local command = "/www/hls/start_ffmpeg.sh " .. channel .. " " .. stream_url
    local handle = io.popen(command .. " 2>&1")
    local result = handle:read("*all")
    handle:close()
end

-- 요청 처리 함수
function handle_request(env)

    local send = uhttpd.send

    -- 요청 URL과 포트 번호
    local request_url = env.REQUEST_URI
    local server_port = env.SERVER_PORT or ""
    --nixio.syslog("debug", "uri=" .. request_url .. "  server_port=:" .. server_port)

    if server_port == "" then
        send("Status: 500 Internal Server Error\r\n")
        send("Content-Type: text/plain\r\n")
        send("\r\nSERVER_PORT is missing")

        --nixio.syslog("debug", "=== 001 ===")
        return
    end

    if request_url == "/hls/" or request_url == "/hls" then
        local file_path = "/www/hls/hls_stream.html"
        local file = io.open(file_path, "r")

        if file then
            local content = file:read("*all")
            file:close()

            send("Status: 200 OK\r\n")
            send("Content-Type: text/html\r\n")
            send("Cache-Control: no-cache\r\n")
            send("Access-Control-Allow-Origin: *\r\n")
            send("Access-Control-Allow-Methods: GET, OPTIONS\r\n")
            send("Access-Control-Allow-Headers: Content-Type\r\n")
            send("\r\n")
            send(content)

            --nixio.syslog("debug", "=== 002 ===")
       end
    end

    local channel = math.floor(tonumber(server_port) / 1000) % 10
    local stream_file_dir = string.format("/www/hls/stream/%d/", channel)
    local ffmpeg_lock = string.format("/tmp/lock/ffmpeg_%d.lock", channel)
    local index_file = string.format("/www/hls/stream/%d/index.m3u8", channel)
    local hls_lock = string.format("/tmp/lock/hls_%d.lock", channel)

    -- hls 요청 시간 업데이트
    os.execute("touch " .. hls_lock)

    -- 파일 개수 확인 함수
    local function checkFileCount(dir)
        local file_count = file_count_in_dir(dir)
        if file_count and file_count >= 3 then
            return true
        else
            return false
        end
    end

    -- index.m3u8 파일 존재 여부 확인
    local function is_created_index(index_file)
        return is_file_exists(index_file)
    end

    -- 락 파일 존재 여부 확인
    local function is_ffmpeg_running(ffmpeg_lock)
        return is_file_exists(ffmpeg_lock)
    end

    -- index.m3u8 요청일 경우
    if request_url:match("index%.m3u8") then
        if not is_ffmpeg_running(ffmpeg_lock) or not is_created_index(index_file) or not checkFileCount(stream_file_dir) then
            send("Status: 404 Not Found\r\n")
            send("Content-Type: text/plain\r\n")
            send("\r\nError: Server is not ready")
            --nixio.syslog("debug", "=== 003 ===")
            return
        end
    end

    if request_url:match("%.m3u8$") or request_url:match("%.ts$") then
        local file_path = "/www" .. request_url
        --nixio.syslog("debug", "file_path " .. file_path)
        local file = io.open(file_path, "rb")
        if file then
            --nixio.syslog("debug", "=== 004 ===")

            local content = file:read("*all")
            file:close()

            send("Status: 200 OK\r\n")
            send("Content-Type: " .. (request_url:match("%.m3u8$") and "application/vnd.apple.mpegurl" or "video/mp2t") .. "\r\n")
            send("Cache-Control: no-cache\r\n")
            send("\r\n")
            send(content)
        else
            --nixio.syslog("debug", "005")
            send("Status: 404 Not Found\r\n")
            send("Content-Type: text/plain\r\n")
            send("\r\n")
            send("File not found")
        end
    end

    -- FFmpeg가 실행 중이지 않으면 시작
    if not is_ffmpeg_running(ffmpeg_lock) then
        local handle = io.popen("uci get camera.@camera[" .. (channel - 1) .. "].selectedrtsp")
        local rtsp_url = handle:read("*a"):gsub("%s+", "")
        handle:close()

        --nixio.syslog("debug", "=== 006 ===")

        if rtsp_url == "" then
            send("Status: 404 Not Found\r\n")
            send("Content-Type: text/plain\r\n")
            send("\r\nError: RTSP URL is empty")
            --nixio.syslog("debug", "=== 007 ===")
            return
        end

        execute_ffmpeg(channel, rtsp_url)
    end

end

