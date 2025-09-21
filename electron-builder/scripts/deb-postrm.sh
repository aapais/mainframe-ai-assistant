#!/bin/bash
#
# Post-removal script for Debian/Ubuntu packages
# Runs after the package is removed
#

set -e

PACKAGE_NAME="mainframe-ai-assistant"
BIN_DIR="/usr/local/bin"

echo "Running post-removal cleanup for $PACKAGE_NAME..."

# Remove symbolic link
if [ -L "$BIN_DIR/$PACKAGE_NAME" ]; then
    rm -f "$BIN_DIR/$PACKAGE_NAME"
    echo "Removed symbolic link: $BIN_DIR/$PACKAGE_NAME"
fi

# Update desktop database
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database /usr/share/applications
    echo "Updated desktop database"
fi

# Update MIME database
if command -v update-mime-database >/dev/null 2>&1; then
    update-mime-database /usr/share/mime
    echo "Updated MIME database"
fi

# Update icon cache
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    if [ -d "/usr/share/icons/hicolor" ]; then
        gtk-update-icon-cache -t /usr/share/icons/hicolor
        echo "Updated icon cache"
    fi
fi

# Remove autostart entries for all users
find /home -name ".config/autostart/$PACKAGE_NAME.desktop" -delete 2>/dev/null || true
echo "Removed autostart entries"

# Stop and disable systemd service if it exists
if command -v systemctl >/dev/null 2>&1; then
    SYSTEMD_SERVICE="$PACKAGE_NAME.service"
    if systemctl is-active --quiet "$SYSTEMD_SERVICE"; then
        systemctl stop "$SYSTEMD_SERVICE"
        echo "Stopped $SYSTEMD_SERVICE"
    fi

    if systemctl is-enabled --quiet "$SYSTEMD_SERVICE"; then
        systemctl disable "$SYSTEMD_SERVICE"
        echo "Disabled $SYSTEMD_SERVICE"
    fi

    # Remove service file
    SYSTEMD_SERVICE_FILE="/etc/systemd/system/$SYSTEMD_SERVICE"
    if [ -f "$SYSTEMD_SERVICE_FILE" ]; then
        rm -f "$SYSTEMD_SERVICE_FILE"
        systemctl daemon-reload
        echo "Removed systemd service file"
    fi
fi

# Remove AppArmor profile if it exists
APPARMOR_PROFILE="/etc/apparmor.d/$PACKAGE_NAME"
if command -v aa-status >/dev/null 2>&1 && [ -f "$APPARMOR_PROFILE" ]; then
    apparmor_parser -R "$APPARMOR_PROFILE"
    rm -f "$APPARMOR_PROFILE"
    echo "Removed AppArmor profile"
fi

# Remove logrotate configuration
LOGROTATE_CONF="/etc/logrotate.d/$PACKAGE_NAME"
if [ -f "$LOGROTATE_CONF" ]; then
    rm -f "$LOGROTATE_CONF"
    echo "Removed logrotate configuration"
fi

# Clean up log directory (preserve logs unless purging)
if [ "$1" = "purge" ]; then
    LOG_DIR="/var/log/$PACKAGE_NAME"
    if [ -d "$LOG_DIR" ]; then
        rm -rf "$LOG_DIR"
        echo "Removed log directory: $LOG_DIR"
    fi

    # Remove user data directories (ask user)
    echo "Removing user configuration directories..."
    find /home -type d -name ".config/$PACKAGE_NAME" -exec rm -rf {} + 2>/dev/null || true
    find /home -type d -name ".local/share/$PACKAGE_NAME" -exec rm -rf {} + 2>/dev/null || true
    echo "Removed user data directories"
fi

echo "Post-removal cleanup completed!"

exit 0