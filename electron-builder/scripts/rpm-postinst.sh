#!/bin/bash
#
# Post-installation script for RPM packages (RedHat/CentOS/Fedora)
# Runs after the package is installed
#

set -e

PACKAGE_NAME="mainframe-ai-assistant"
APP_DIR="/opt/$PACKAGE_NAME"
BIN_DIR="/usr/local/bin"

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

# Update icon cache
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    if [ -d "/usr/share/icons/hicolor" ]; then
        gtk-update-icon-cache -t /usr/share/icons/hicolor
        echo "Updated icon cache"
    fi
fi

# Create application directories for users
for user_home in /home/*; do
    if [ -d "$user_home" ]; then
        username=$(basename "$user_home")
        USER_DATA_DIR="$user_home/.config/$PACKAGE_NAME"

        if [ ! -d "$USER_DATA_DIR" ]; then
            mkdir -p "$USER_DATA_DIR"
            chown -R "$username:$username" "$USER_DATA_DIR" 2>/dev/null || true
            echo "Created user data directory: $USER_DATA_DIR"
        fi
    fi
done

# Configure SELinux context if SELinux is enabled
if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce)" != "Disabled" ]; then
    if command -v setsebool >/dev/null 2>&1; then
        # Allow application to create files in user home directories
        setsebool -P allow_user_exec_content on 2>/dev/null || echo "Could not set SELinux boolean (may require manual configuration)"
    fi

    if command -v restorecon >/dev/null 2>&1; then
        restorecon -R "$APP_DIR" 2>/dev/null || echo "Could not restore SELinux context"
    fi

    echo "Configured SELinux context"
fi

# Set up systemd service
if command -v systemctl >/dev/null 2>&1; then
    SYSTEMD_SERVICE_FILE="/etc/systemd/system/$PACKAGE_NAME.service"

    # Create systemd service file
    cat > "$SYSTEMD_SERVICE_FILE" << EOF
[Unit]
Description=Mainframe AI Assistant Service
After=network.target

[Service]
Type=simple
User=mainframe
Group=mainframe
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/$PACKAGE_NAME --service
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # Create service user
    if ! id "mainframe" >/dev/null 2>&1; then
        useradd -r -s /bin/false -d "$APP_DIR" mainframe
        echo "Created service user: mainframe"
    fi

    systemctl daemon-reload
    echo "Created systemd service (run 'systemctl enable $PACKAGE_NAME' to auto-start)"
fi

# Install dependencies using package manager
if command -v dnf >/dev/null 2>&1; then
    PKG_MANAGER="dnf"
elif command -v yum >/dev/null 2>&1; then
    PKG_MANAGER="yum"
else
    PKG_MANAGER=""
fi

if [ -n "$PKG_MANAGER" ]; then
    # Check for recommended packages
    RECOMMENDED_PACKAGES="curl git nodejs npm"
    for package in $RECOMMENDED_PACKAGES; do
        if ! rpm -q "$package" >/dev/null 2>&1; then
            echo "Consider installing recommended package: $package"
            echo "  sudo $PKG_MANAGER install $package"
        fi
    done
fi

# Create log directory
LOG_DIR="/var/log/$PACKAGE_NAME"
if [ ! -d "$LOG_DIR" ]; then
    mkdir -p "$LOG_DIR"
    chmod 755 "$LOG_DIR"

    # Set ownership to service user if it exists
    if id "mainframe" >/dev/null 2>&1; then
        chown mainframe:mainframe "$LOG_DIR"
    fi

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
    su mainframe mainframe
}
EOF
    echo "Created logrotate configuration"
fi

# Configure firewall if firewalld is active
if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
    # Add service to firewall (if application uses network ports)
    # firewall-cmd --permanent --add-service=mainframe-ai-assistant
    # firewall-cmd --reload
    echo "Firewall configuration may be needed for network features"
fi

# Create application launcher script
LAUNCHER_SCRIPT="/usr/local/bin/$PACKAGE_NAME-launcher"
cat > "$LAUNCHER_SCRIPT" << EOF
#!/bin/bash
# Launcher script for Mainframe AI Assistant

export ELECTRON_DISABLE_GPU_SANDBOX=1
export ELECTRON_NO_ATTACH_CONSOLE=1

# Set XDG directories
export XDG_CONFIG_HOME="\${XDG_CONFIG_HOME:-\$HOME/.config}"
export XDG_DATA_HOME="\${XDG_DATA_HOME:-\$HOME/.local/share}"
export XDG_CACHE_HOME="\${XDG_CACHE_HOME:-\$HOME/.cache}"

# Launch application
exec "$APP_DIR/$PACKAGE_NAME" "\$@"
EOF

chmod +x "$LAUNCHER_SCRIPT"
echo "Created launcher script: $LAUNCHER_SCRIPT"

echo "Post-installation setup completed successfully!"

# Display installation information
cat << EOF

==============================================
Mainframe AI Assistant has been installed!
==============================================

Application location: $APP_DIR
Command line access: $PACKAGE_NAME
Launcher script: $LAUNCHER_SCRIPT

To get started:
1. Launch from applications menu or run '$PACKAGE_NAME'
2. To enable system service: systemctl enable $PACKAGE_NAME
3. Check logs: journalctl -u $PACKAGE_NAME
4. Documentation: /usr/share/doc/$PACKAGE_NAME/

Report issues at: https://github.com/your-org/mainframe-ai-assistant/issues

Thank you for installing Mainframe AI Assistant!

EOF

exit 0