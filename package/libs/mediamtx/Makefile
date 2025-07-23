#
# This is free software, licensed under the MIT License.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=mediamtx
PKG_VERSION:=1.12.0-custom
PKG_RELEASE:=1

PKG_SOURCE:=
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/mediamtx
  SECTION:=multimedia
  CATEGORY:=Multimedia
  TITLE:=MediaMTX (prebuilt, with config and Lua script)
  DEPENDS:=+libstdcpp
endef

# Skip configure and compile steps
define Build/Configure
endef

define Build/Compile
endef

define Package/mediamtx/description
MediaMTX (formerly rtsp-simple-server) with prebuilt binary, configuration,
and supporting Lua script, all installed under /usr/lib/rtsp-proxy/.
endef

define Package/mediamtx/install
	# create directory
	$(INSTALL_DIR) $(1)/usr/lib/rtsp-proxy

	# install mediamtx binary with executable permission
	$(INSTALL_BIN) ./files/usr/lib/rtsp-proxy/mediamtx $(1)/usr/lib/rtsp-proxy/

	# install Lua script as executable
	$(INSTALL_BIN) ./files/usr/lib/rtsp-proxy/generate_rtsp_config.lua $(1)/usr/lib/rtsp-proxy/
endef

$(eval $(call BuildPackage,mediamtx))

