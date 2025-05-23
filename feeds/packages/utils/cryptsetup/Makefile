#
# Copyright (C) 2006-2014 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=cryptsetup
PKG_VERSION:=2.3.4
PKG_RELEASE:=2

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.xz
PKG_SOURCE_URL:=
PKG_HASH:=9d16eebb96b53b514778e813019b8dd15fea9fec5aafde9fae5febf59df83773

PKG_MAINTAINER:=Daniel Golle <daniel@makrotopia.org>
PKG_LICENSE:=GPL-2.0-or-later LGPL-2.1-or-later
PKG_LICENSE_FILES:=COPYING COPYING.LGPL

PKG_FIXUP:=autoreconf
PKG_INSTALL:=1
PKG_BUILD_PARALLEL:=1

PKG_BUILD_DEPENDS:=!USE_GLIBC:argp-standalone

HOST_BUILD_DEPENDS:=lvm2/host libjson-c/host popt/host
HOST_BUILD_PREFIX:=$(STAGING_DIR_HOST)

include $(INCLUDE_DIR)/package.mk
include $(INCLUDE_DIR)/nls.mk
include $(INCLUDE_DIR)/host-build.mk

define Package/cryptsetup
  SECTION:=utils
  CATEGORY:=Utilities
  SUBMENU:=Encryption
  TITLE:=Cryptsetup
  DEPENDS:=$(ICONV_DEPENDS) $(INTL_DEPENDS) +libblkid +libuuid +libpopt +lvm2 \
           +libdevmapper +libjson-c +@KERNEL_DIRECT_IO +kmod-crypto-user
  URL:=https://gitlab.com/cryptsetup/cryptsetup/
endef

define Package/cryptsetup/description
  Cryptsetup is utility used to conveniently setup disk encryption based on DMCrypt kernel module.
endef

define Package/cryptsetup-ssh
  SECTION:=utils
  CATEGORY:=Utilities
  SUBMENU:=Encryption
  TITLE:=Cryptsetup SSH token
  DEPENDS:=+cryptsetup +PACKAGE_cryptsetup-ssh:libssh
  URL:=https://gitlab.com/cryptsetup/cryptsetup/
endef

define Package/cryptsetup-ssh/description
  Experimental SSH token support for cryptsetup.
endef

CONFIGURE_ARGS += \
	--disable-asciidoc \
	--disable-cryptsetup-reencrypt \
	--disable-integritysetup \
	--disable-selinux \
	--disable-rpath \
	--disable-veritysetup \
	--disable-udev \
	--with-default-luks-format=LUKS2 \
	--with-luks2-lock-path=/var/run/cryptsetup \
	--with-crypto_backend=kernel

ifeq ($(CONFIG_PACKAGE_cryptsetup-ssh),)
CONFIGURE_ARGS += --disable-ssh-token
endif

CONFIGURE_VARS += \
	LIBSSH_CFLAGS="-I$(STAGING_DIR)/usr/include" \
	LIBSSH_LIBS="-L$(STAGING_DIR)/usr/lib -lssh"

TARGET_LDFLAGS += -Wl,--gc-sections $(if $(INTL_FULL),-lintl)

HOST_CONFIGURE_ARGS += \
	--with-crypto-backend=openssl \
	$(STAGING_DIR_HOST) \
	--disable-kernel_crypto \
	--disable-blkid \
	--enable-libiconv-tiny

define Build/InstallDev
	$(INSTALL_DIR) $(1)/usr/include
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/usr/include/libcryptsetup.h $(1)/usr/include
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/libcryptsetup.so* $(1)/usr/lib
	$(INSTALL_DIR) $(1)/usr/lib/pkgconfig
	$(INSTALL_DATA) $(PKG_INSTALL_DIR)/usr/lib/pkgconfig/libcryptsetup.pc $(1)/usr/lib/pkgconfig
endef

define Package/cryptsetup/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/libcryptsetup.so* $(1)/usr/lib
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/sbin/cryptsetup $(1)/usr/sbin
endef

define Package/cryptsetup-ssh/install
	$(INSTALL_DIR) $(1)/usr/lib/cryptsetup
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/cryptsetup/* $(1)/usr/lib/cryptsetup
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/sbin/cryptsetup-ssh $(1)/usr/sbin
endef

define Host/Install
	$(INSTALL_BIN) $(HOST_BUILD_DIR)/veritysetup $(STAGING_DIR_HOST)/bin/veritysetup
	$(INSTALL_BIN) $(HOST_BUILD_DIR)/cryptsetup $(STAGING_DIR_HOST)/bin/cryptsetup
	$(CP) $(HOST_BUILD_DIR)/.libs $(STAGING_DIR_HOST)/bin/
endef

$(eval $(call BuildPackage,cryptsetup))
$(eval $(call BuildPackage,cryptsetup-ssh))
$(eval $(call HostBuild))
