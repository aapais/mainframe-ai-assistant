#!/bin/bash
#
# Post-installation script for Debian/Ubuntu packages
# Runs after the package is installed
#

set -e

PACKAGE_NAME="mainframe-ai-assistant"
APP_DIR="/opt/$PACKAGE_NAME"
BIN_DIR="/usr/local/bin"
DESKTOP_FILE="/usr/share/applications/$PACKAGE_NAME.desktop"

echo "Running post-installation setup for $PACKAGE_NAME..."

# Create symbolic link for command-line access
if [ -f "$APP_DIR/$PACKAGE_NAME" ]; then
    ln -sf "$APP_DIR/$PACKAGE_NAME" "$BIN_DIR/$PACKAGE_NAME"
    echo "Created symbolic link: $BIN_DIR/$PACKAGE_NAME"
fi

# Set proper permissions
if [ -d "$APP_DIR" ]; then
    chmod -R 755 "$APP_DIR"
    echo "Set permissions for $APP_DIR"
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

# Register custom MIME types
if [ -f "/usr/share/mime/packages/$PACKAGE_NAME.xml" ]; then
    update-mime-database /usr/share/mime
    echo "Registered MIME types"
fi

# Update icon cache
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    if [ -d "/usr/share/icons/hicolor" ]; then
        gtk-update-icon-cache -t /usr/share/icons/hicolor
        echo "Updated icon cache"
    fi
fi

# Create application directories
USER_DATA_DIR="/home/$SUDO_USER/.config/$PACKAGE_NAME"
if [ -n "$SUDO_USER" ] && [ ! -d "$USER_DATA_DIR" ]; then
    mkdir -p "$USER_DATA_DIR"
    chown -R "$SUDO_USER:$SUDO_USER" "$USER_DATA_DIR"
    echo "Created user data directory: $USER_DATA_DIR"
fi

# Set up autostart (optional)
AUTOSTART_DIR="/home/$SUDO_USER/.config/autostart"
AUTOSTART_FILE="$AUTOSTART_DIR/$PACKAGE_NAME.desktop"

if [ -n "$SUDO_USER" ]; then
    if [ ! -d "$AUTOSTART_DIR" ]; then
        mkdir -p "$AUTOSTART_DIR"
        chown -R "$SUDO_USER:$SUDO_USER" "$AUTOSTART_DIR"
    fi

    # Create autostart desktop file (disabled by default)
    cat > "$AUTOSTART_FILE" << EOF
[Desktop Entry]
Type=Application
Name=Mainframe AI Assistant
Comment=AI-powered mainframe assistant
Exec=$PACKAGE_NAME --startup
Icon=$PACKAGE_NAME
Terminal=false
Hidden=true
X-GNOME-Autostart-enabled=false
StartupNotify=true
Categories=Development;Utility;
EOF

    chown "$SUDO_USER:$SUDO_USER" "$AUTOSTART_FILE"
    echo "Created autostart entry (disabled by default)"
fi

# Configure AppArmor profile if available
APPARMOR_PROFILE="/etc/apparmor.d/$PACKAGE_NAME"
if command -v aa-status >/dev/null 2>&1 && [ -f "$APPARMOR_PROFILE" ]; then
    apparmor_parser -r "$APPARMOR_PROFILE"
    echo "Loaded AppArmor profile"
fi

# Set up system service (if systemd is available)
if command -v systemctl >/dev/null 2>&1; then
    SYSTEMD_SERVICE="/etc/systemd/system/$PACKAGE_NAME.service"
    if [ -f "$SYSTEMD_SERVICE" ]; then
        systemctl daemon-reload
        echo "Reloaded systemd services"
        echo "To enable the service, run: systemctl enable $PACKAGE_NAME"
    fi
fi

# Install any additional dependencies
if command -v apt-get >/dev/null 2>&1; then
    # Install recommended packages if not already installed
    RECOMMENDED_PACKAGES="curl git nodejs"
    for package in $RECOMMENDED_PACKAGES; do
        if ! dpkg -l | grep -q "^ii.*$package"; then
            echo "Consider installing recommended package: $package"
            echo "  sudo apt-get install $package"
        fi
    done
fi

# Create log directory
LOG_DIR="/var/log/$PACKAGE_NAME"
if [ ! -d "$LOG_DIR" ]; then
    mkdir -p "$LOG_DIR"
    chmod 755 "$LOG_DIR"
    echo "Created log directory: $LOG_DIR"
fi

# Set up logrotate configuration
LOGROTATE_CONF="/etc/logrotate.d/$PACKAGE_NAME"
if [ ! -f "$LOGROTATE_CONF" ]; then
    cat > "$LOGROTATE_CONF" << EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF
    echo "Created logrotate configuration"
fi

echo "Post-installation setup completed successfully!"

# Display installation information
cat << EOF

==============================================
Mainframe AI Assistant has been installed!
==============================================

Application location: $APP_DIR
Command line access: $PACKAGE_NAME
Desktop entry: Applications > Development

To get started:
1. Launch from applications menu or run '$PACKAGE_NAME'
2. Check the documentation at /usr/share/doc/$PACKAGE_NAME/
3. Report issues at: https://github.com/your-org/mainframe-ai-assistant/issues

Thank you for installing Mainframe AI Assistant!

EOF

exit 0