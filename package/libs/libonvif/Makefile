#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=libonvif
PKG_VERSION:=2.0.9
#PKG_VERSION:=1.2.0
PKG_RELEASE:=1
CMAKE_INSTALL:=1

PKG_SOURCE:=v$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://github.com/sr99622/libonvif/archive/refs/tags/
# v2.0.9
PKG_HASH:=9fcefe604ca528976361e14bed08434b4fec949c00001006819e6bbd3a200ddb
# v1.2.0
#PKG_HASH:=427dc4a24307fa1fbfcbf8d5a204e5dbcd37f3a549489645b047592a26987806
# v1.1.1
#PKG_HASH:=d449bd51af0917edab9672bb682fdb6b6661717505dbda173e0ce50216f76279

PKG_MAINTAINER:=Stephen Rhodes
PKG_LICENSE:=LGPL-2.1
PKG_LICENSE_FILES:=

include $(INCLUDE_DIR)/package.mk
include $(INCLUDE_DIR)/cmake.mk

CMAKE_OPTIONS += -DWITHOUT_PYTHON=ON

define Package/libonvif/Default
  TITLE:=ONVIF Library and Utilities
  URL:=https://github.com/sr99622/libonvif
  SECTION:=libs
  CATEGORY:=Libraries
endef

define Package/libonvif
$(call Package/libonvif/Default)
  SUBMENU:=ONVIF
  DEPENDS:=+libxml2 +libstdcpp
  TITLE+= (library)
endef

define Package/onvif-util
$(call Package/libonvif/Default)
  SECTION:=utils
  CATEGORY:=Utilities
  SUBMENU:=ONVIF
  DEPENDS:=+libonvif
  TITLE+= (utility)
endef

define Package/libonvif/description
	A client side implementation of the ONVIF specification for Linux, Mac and Windows.
	Included are two tools for communicating with cameras, a command line program, onvif-util,
	and a program with a Graphical User Interface, onvi-gui.
endef

define Package/libonvif/install
	$(INSTALL_DIR) $(1)/usr/lib
	$(CP) $(PKG_INSTALL_DIR)/usr/lib/libonvif.so.* $(1)/usr/lib/
endef

define Package/onvif-util/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/usr/bin/onvif-util $(1)/usr/bin/
endef

$(eval $(call BuildPackage,libonvif))
$(eval $(call BuildPackage,onvif-util))

