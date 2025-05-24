#!/usr/bin/env luajit

local ffi = require "ffi"
ffi.cdef[[
    void *memset(void *s, int c, size_t n);
    void *memcpy(void *dest, const void *src, size_t n);
]]

local KEK_PATH = "/etc/.kek"
local DEK_PATH = "/etc/.dek"

local function safe_popen_read(cmd)
    local handle = io.popen(cmd)
    if not handle then
        return ""
    end
    local result = handle:read("*a")
    handle:close()
    if not result then
        return ""
    end
    return result
end

-- 암복호화 수행 시 FFI 기반 C 버퍼에 키를 로드한다.
function copy_to_cbuf(str)
    local len = #str
    local buf = ffi.new("char[?]", len + 1)
    ffi.copy(buf, str, len)
    buf[len] = 0
    return buf, len
end

-- 작업 종료 직전, 해당 메모리 공간을 0으로 초기화하여 키를 안전하게 파기한다.
function secure_wipe_cbuf(buf, len)
    ffi.C.memset(buf, 0, len)
end

-- 문자열 키 역시 무의미한 값으로 덮어쓴 뒤 가비지 컬렉션을 수행한다.
function destroy_string(str)
	if type(str) ~= "string" then return end
	local dummy = string.rep("X", #str)
	str = nil  -- 기존 문자열 참조 해제
	dummy = nil  -- 덮어쓴 더미도 해제
	collectgarbage("collect")  -- 즉시 GC 유도
end

-- 파일로 저장된 키는 0x00, 0xFF, 0x00 값으로 3회 덮어쓴 후 삭제된다.
function overwrite_and_delete(path)
	local size = 0

	-- 먼저 파일 크기 확인
	local f = io.open(path, "rb")
	if not f then return end
	local content = f:read("*a")
	f:close()
	size = #content

	-- 3회 덮어쓰기: 0x00, 0xFF, 0x00 (0, 1, 0)
	local patterns = { string.char(0x00), string.char(0xFF), string.char(0x00) }
	for _, pattern in ipairs(patterns) do
		local f = io.open(path, "wb")
		if f then
			f:write(string.rep(pattern, size))
			f:close()
		end
	end

	-- 마지막으로 삭제
	os.remove(path)
end

-- 파일 존재 여부 확인
function file_exists(path)
	local f = io.open(path, "r")
	if f then f:close() return true else return false end
end

-- 랜덤 키 생성
function generate_key()
	local key = safe_popen_read("openssl rand -base64 32")
	return key:gsub("\n", "")
end

-- 키 파일 저장 (권한 600)
function save_key(path, key)
	local file = io.open(path, "w")
	if file then
		file:write(key)
		file:close()
		os.execute("chmod 600 " .. path)
	else
		error("Unable to write key file: " .. path)
	end
end

-- KEK 생성 및 저장
function generate_kek()
	local kek = generate_key()
	save_key(KEK_PATH, kek)
	return kek
end

-- DEK 생성, KEK로 암호화해서 저장
function generate_and_store_dek(kek)
	local dek = generate_key()
	local enc_cmd = string.format('echo -n "%s" | openssl enc -aes-256-cbc -base64 -pbkdf2 -pass pass:%s > %s', dek, kek, DEK_PATH)
	os.execute(enc_cmd)
	os.execute("chmod 600 " .. DEK_PATH)
	return dek
end

-- KEK로 DEK 복호화
function decrypt_dek(kek)
	local cmd = string.format('openssl enc -aes-256-cbc -d -base64 -pbkdf2 -in %s -pass pass:%s', DEK_PATH, kek)
	local dek = safe_popen_read(cmd)
	return dek:gsub("\n", "")
end

-- DEK 가져오기 (없으면 생성)
function getEncryptKey(action)
	local kek, dek

	if file_exists(KEK_PATH) then
		local f = io.open(KEK_PATH, "r")
		kek = f:read("*a"):gsub("\n", "")
		f:close()
	else
		kek = generate_kek()
	end

	if file_exists(DEK_PATH) then
		dek = decrypt_dek(kek)
	elseif action == "encrypt" then
		dek = generate_and_store_dek(kek)
	else
		dek = ""
	end

	local dek_buf, dek_len = copy_to_cbuf(dek)
	destroy_string(dek)
	return dek_buf, dek_len
end

-- 키 파기 함수
function destroy_keys()
	overwrite_and_delete("/etc/.kek")
	overwrite_and_delete("/etc/.dek")
end

-- 명령 처리
local arg = arg or {}

if arg[1] == "encrypt" then
	local plaintext = arg[2] or ""
	if plaintext == "" then
		print("")
		os.exit(0)
	end

	local dek_buf, dek_len = getEncryptKey("encrypt")
	local dek_str = ffi.string(dek_buf, dek_len)

	local cmd = string.format('echo -n "%s" | openssl enc -aes-256-cbc -base64 -pbkdf2 -pass pass:%s', plaintext, dek_str)
	local result = safe_popen_read(cmd)

	secure_wipe_cbuf(dek_buf, dek_len)
	destroy_string(dek_str)

	print(result:match("^%s*(.-)%s*$"))
	os.exit(0)
elseif arg[1] == "decrypt" then
	local encrypted = arg[2] or ""
	if encrypted == "" then
		print("")
		os.exit(0)
	end

	local dek_buf, dek_len = getEncryptKey("encrypt")
	local dek_str = ffi.string(dek_buf, dek_len)

	encrypted = encrypted .. "\n" 

	-- 임시 파일에 암호문 저장
	local tmpFile = "/tmp/tmpEncrypted.txt"
	local f = io.open(tmpFile, "w")
	if f then
		f:write(encrypted)
		f:close()
	end

	local cmd = string.format('openssl enc -aes-256-cbc -d -base64 -pbkdf2 -in %s -pass pass:%s', tmpFile, dek_str)
	local result = safe_popen_read(cmd)
	os.remove(tmpFile)

	secure_wipe_cbuf(dek_buf, dek_len)
	destroy_string(dek_str)

	print(result:match("^%s*(.-)%s*$"))
	os.exit(0)
elseif arg[1] == "get_dek" then
	local dek_buf, dek_len = getEncryptKey("encrypt")
	local dek_str = ffi.string(dek_buf, dek_len)
	print(dek_str)
	secure_wipe_cbuf(dek_buf, dek_len)
	destroy_string(dek_str)
elseif arg[1] == "destroy_keys" then
	destroy_keys()
	print("OK")
end
