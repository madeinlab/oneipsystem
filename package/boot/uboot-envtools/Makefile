#
# Copyright (C) 2006-2014 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=uboot-envtools
PKG_DISTNAME:=uboot-mtk
PKG_VERSION:=20220606
PKG_VERSION_ADDITION:=rtl8370mb
PKG_RELEASE:=$(AUTORELEASE)

PKG_SOURCE:=$(PKG_DISTNAME)-$(PKG_VERSION).$(PKG_VERSION_ADDITION).tar.gz
PKG_SOURCE_URL:=
PKG_HASH:=0d1d73d176db1c920510479d67544cb7c783d619c7a4ef1064ccd3bf42463835
PKG_SOURCE_SUBDIR:=$(PKG_DISTNAME)-$(PKG_VERSION)
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_DISTNAME)-$(PKG_VERSION)

PKG_BUILD_DEPENDS:=fstools

PKG_LICENSE:=GPL-2.0 GPL-2.0+
PKG_LICENSE_FILES:=Licenses/README

PKG_FLAGS:=nonshared

PKG_BUILD_PARALLEL:=1

include $(INCLUDE_DIR)/package.mk

define Package/uboot-envtools
  SECTION:=utils
  CATEGORY:=Utilities
  SUBMENU:=Boot Loaders
  TITLE:=read/modify U-Boot bootloader environment
  URL:=http://www.denx.de/wiki/U-Boot
endef

define Package/uboot-envtools/description
 This package includes tools to read and modify U-Boot bootloader environment.
endef

define Build/Configure
	touch $(PKG_BUILD_DIR)/include/config.h
	mkdir -p $(PKG_BUILD_DIR)/include/config
	touch $(PKG_BUILD_DIR)/include/config/auto.conf
	mkdir -p $(PKG_BUILD_DIR)/include/generated
	touch $(PKG_BUILD_DIR)/include/generated/autoconf.h
endef

MAKE_FLAGS += \
	TARGET_CFLAGS="$(TARGET_CFLAGS)" \
	TARGET_LDFLAGS="$(TARGET_LDFLAGS)" \
	no-dot-config-targets=envtools \
	envtools

define Package/uboot-envtools/conffiles
/etc/config/ubootenv
/etc/fw_env.config
endef

define Package/uboot-envtools/install
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/tools/env/fw_printenv $(1)/usr/sbin
	$(LN) fw_printenv $(1)/usr/sbin/fw_setenv
	$(INSTALL_DIR) $(1)/lib
	$(INSTALL_DATA) ./files/uboot-envtools.sh $(1)/lib
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(if $(wildcard ./files/$(BOARD)), \
		$(INSTALL_DATA) ./files/$(BOARD) \
		$(1)/etc/uci-defaults/30_uboot-envtools \
	)
endef

define Build/InstallDev
	ln -sf $(PKG_BUILD_DIR)/include $(STAGING_DIR)/usr/include/u-boot
	$(CP) $(PKG_BUILD_DIR)/tools/env/lib.a  $(STAGING_DIR)/usr/lib/libuboot-envtools.a
	$(CP) $(PKG_BUILD_DIR)/tools/env/fw_env.h $(STAGING_DIR)/usr/include/fw_env.h
endef

$(eval $(call BuildPackage,uboot-envtools))
