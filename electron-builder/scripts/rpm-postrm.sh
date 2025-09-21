#!/bin/bash
#
# Post-removal script for RPM packages (RedHat/CentOS/Fedora)
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

# Remove launcher script
LAUNCHER_SCRIPT="$BIN_DIR/$PACKAGE_NAME-launcher"
if [ -f "$LAUNCHER_SCRIPT" ]; then
    rm -f "$LAUNCHER_SCRIPT"
    echo "Removed launcher script: $LAUNCHER_SCRIPT"
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

# Stop and disable systemd service
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

# Remove service user (only if package is being purged)
if [ "$1" = "0" ]; then  # RPM removal (not upgrade)
    if id "mainframe" >/dev/null 2>&1; then
        userdel mainframe 2>/dev/null || echo "Could not remove service user 'mainframe'"
        echo "Removed service user"
    fi
fi

# Remove firewall rules if they exist
if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
    # Remove service from firewall
    # firewall-cmd --permanent --remove-service=mainframe-ai-assistant 2>/dev/null || true
    # firewall-cmd --reload
    echo "Firewall rules may need manual cleanup"
fi

# Remove logrotate configuration
LOGROTATE_CONF="/etc/logrotate.d/$PACKAGE_NAME"
if [ -f "$LOGROTATE_CONF" ]; then
    rm -f "$LOGROTATE_CONF"
    echo "Removed logrotate configuration"
fi

# Clean up log directory (only on complete removal)
if [ "$1" = "0" ]; then  # Complete removal, not upgrade
    LOG_DIR="/var/log/$PACKAGE_NAME"
    if [ -d "$LOG_DIR" ]; then
        rm -rf "$LOG_DIR"
        echo "Removed log directory: $LOG_DIR"
    fi

    # Remove user data directories (optional - prompt user)
    echo "To remove user configuration data, run:"
    echo "  find /home -type d -name '.config/$PACKAGE_NAME' -exec rm -rf {} +"
    echo "  find /home -type d -name '.local/share/$PACKAGE_NAME' -exec rm -rf {} +"
fi

# Reset SELinux context
if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce)" != "Disabled" ]; then
    # Reset any custom SELinux contexts that were set
    echo "SELinux contexts may need manual cleanup"
fi

echo "Post-removal cleanup completed!"

# Display removal information
if [ "$1" = "0" ]; then
    cat << EOF

==============================================
Mainframe AI Assistant has been removed
==============================================

The application has been completely removed from your system.

If you experienced any issues, please report them at:
https://github.com/your-org/mainframe-ai-assistant/issues

Thank you for using Mainframe AI Assistant!

EOF
fi

exit 0