# Rootless by default. For a rootful jailbreak, comment the next line out.
THEOS_PACKAGE_SCHEME = rootless

ARCHS = arm64 arm64e
TARGET = iphone:clang:latest:14.0

include $(THEOS)/makefiles/common.mk

TWEAK_NAME = PaleTools

PaleTools_FILES = Tweak.x
PaleTools_CFLAGS = -fobjc-arc
PaleTools_FRAMEWORKS = WebKit
PaleTools_LIBRARIES = z

# Regenerate the embedded JS header before compiling.
before-all::
	@./build-inject.sh

include $(THEOS_MAKE_PATH)/tweak.mk

# Drop the standalone dylib next to the .deb, for Sideloadly/Feather/TrollFools.
# Pulls the staged copy (same bits that ship in the .deb), rootless or rootful.
after-stage::
	@mkdir -p packages
	@find "$(THEOS_STAGING_DIR)" -name '$(TWEAK_NAME).dylib' -exec cp {} "packages/$(TWEAK_NAME).dylib" \;
	@echo "==> Extracted dylib: packages/$(TWEAK_NAME).dylib"
