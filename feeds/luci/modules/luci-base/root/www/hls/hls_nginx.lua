function file_count_in_dir(dir)
    local cmd = "ls -l " .. dir .. " | wc -l"
    local handle = io.popen(cmd)
    local result = handle:read("*a")
    handle:close()
    return tonumber(result)
end

local function check_file_count(dir)
    local file_count = file_count_in_dir(dir)
    if file_count and file_count >= 3 then
        return true
    else
        return false
    end
end

function is_file_exists(file_path)
    local file = io.open(file_path, "r")
    if file then
        file:close()
        return true
    else
        return false
    end
end

local function is_created_index(index_file)
    return is_file_exists(index_file)
end

local function is_ffmpeg_running(ffmpeg_lock)
    return is_file_exists(ffmpeg_lock)
end

function execute_ffmpeg(channel, stream_url)
    os.execute("chmod +x /www/hls/start_ffmpeg.sh")
    os.execute("/www/hls/start_ffmpeg.sh " .. channel .. " " .. stream_url .. " &")
    ngx.log(ngx.ERR, "FFmpeg started for channel: " .. channel .. " and stream: " .. stream_url)
end

local request_url = ngx.var.request_uri
local server_port = ngx.var.server_port
--ngx.log(ngx.ERR, "START hls_nginx.lua " .. request_url .. "  " .. server_port)

if server_port == "" then
    ngx.status = ngx.HTTP_INTERNAL_SERVER_ERROR
    ngx.say("Error: 500 Internal Server Error")
    ngx.exit(ngx.HTTP_INTERNAL_SERVER_ERROR)
    return
end

local channel = math.floor(server_port / 1000) % 10
local stream_file_dir = string.format("/www/hls/stream/%d/", channel)
local ffmpeg_lock = string.format("/tmp/lock/ffmpeg_%d.lock", channel)
local index_file = string.format("/www/hls/stream/%d/index.m3u8", channel)
local hls_lock = string.format("/tmp/lock/hls_%d.lock", channel)

-- Update the HLS request time
os.execute("touch " .. hls_lock)

-- If the request is for index.m3u8
if request_url:match("index%.m3u8") then
    if not is_ffmpeg_running(ffmpeg_lock) or not is_created_index(index_file) or not check_file_count(stream_file_dir) then
        ngx.log(ngx.ERR, "Server is not ready. Returning 404.")

        ngx.status = ngx.HTTP_NOT_FOUND
        ngx.say("Error: Server is not ready")
        ngx.exit(ngx.HTTP_NOT_FOUND)
    end
end

if request_url:match("%.m3u8$") or request_url:match("%.ts$") then
    local file_path = "/www" .. request_url
    --ngx.log(ngx.ERR, "file_path " .. file_path)
    local file = io.open(file_path, "rb")
    if not file then
        ngx.status = ngx.HTTP_NOT_FOUND
        ngx.say("Error: Server is not ready")
        ngx.exit(ngx.HTTP_NOT_FOUND)
    end
end

if not is_ffmpeg_running(ffmpeg_lock) then
    local handle = io.popen("uci get camera.@camera[" .. (channel - 1) .. "].selectedrtsp")
    local rtsp_url = handle:read("*a")
    handle:close()

    -- Remove whitespace
    rtsp_url = rtsp_url:gsub("%s+", "")

    if rtsp_url == "" then
        ngx.log(ngx.ERR, "RTSP URL is empty. Returning 404.")
        ngx.status = ngx.HTTP_NOT_FOUND
        ngx.say("Error: RTSP URL is empty")
        ngx.exit(ngx.HTTP_NOT_FOUND)
    end

    execute_ffmpeg(channel, rtsp_url)

    -- local ffmpeg_check_command = "ps aux | awk -v url=\'" .. rtsp_url .. "\' \'/ffmpeg/ && $0 ~ url && !/bash/ && !/pgrep/ && !/sh -c/ {print $2}\'"
    -- local handle = io.popen(ffmpeg_check_command)
    -- local ffmpeg_pid = handle:read("*a")
    -- handle:close()
end

--ngx.log(ngx.ERR, "END hls_nginx.lua " .. request_url .. "  " .. server_port)