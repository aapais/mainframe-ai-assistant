#!/bin/bash

# Setup script for pgvector extension in PostgreSQL
# This script installs and configures pgvector for vector similarity search

echo "🚀 pgvector Setup Script"
echo "========================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check if running with sudo
if [ "$EUID" -eq 0 ]; then
   print_info "Running as root"
else
   print_error "Please run this script with sudo"
   exit 1
fi

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    DISTRO=$(lsb_release -si 2>/dev/null || echo "Unknown")
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    OS="windows"
else
    OS="unknown"
fi

print_info "Detected OS: $OS"

# Install pgvector based on OS
install_pgvector() {
    case $OS in
        linux)
            print_info "Installing pgvector on Linux ($DISTRO)..."

            # For Ubuntu/Debian
            if [[ "$DISTRO" == "Ubuntu" ]] || [[ "$DISTRO" == "Debian" ]]; then
                # Add PostgreSQL APT repository if needed
                apt-get update
                apt-get install -y postgresql-common
                /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y

                # Install build dependencies
                apt-get install -y build-essential postgresql-server-dev-all git

                # Clone and build pgvector
                cd /tmp
                git clone --branch v0.7.0 https://github.com/pgvector/pgvector.git
                cd pgvector
                make
                make install

                print_success "pgvector installed successfully on Linux"

            # For RHEL/CentOS/Fedora
            elif [[ "$DISTRO" == "RedHat" ]] || [[ "$DISTRO" == "CentOS" ]] || [[ "$DISTRO" == "Fedora" ]]; then
                yum install -y gcc postgresql-devel git

                cd /tmp
                git clone --branch v0.7.0 https://github.com/pgvector/pgvector.git
                cd pgvector
                make
                make install

                print_success "pgvector installed successfully on Linux"
            else
                print_error "Unsupported Linux distribution: $DISTRO"
                exit 1
            fi
            ;;

        macos)
            print_info "Installing pgvector on macOS..."

            # Check if Homebrew is installed
            if ! command -v brew &> /dev/null; then
                print_error "Homebrew is not installed. Please install Homebrew first."
                exit 1
            fi

            # Install pgvector via Homebrew
            brew install pgvector

            print_success "pgvector installed successfully on macOS"
            ;;

        windows)
            print_info "For Windows, please follow manual installation:"
            echo "1. Download pgvector from: https://github.com/pgvector/pgvector/releases"
            echo "2. Extract and follow the Windows installation instructions"
            echo "3. Or use WSL2 with Ubuntu and run this script again"
            exit 1
            ;;

        *)
            print_error "Unsupported operating system"
            exit 1
            ;;
    esac
}

# Create extension in database
create_extension() {
    print_info "Creating pgvector extension in database..."

    # Default database configuration
    DB_NAME=${DB_NAME:-"assistente_db"}
    DB_USER=${DB_USER:-"assistente_user"}
    DB_HOST=${DB_HOST:-"localhost"}
    DB_PORT=${DB_PORT:-"5432"}

    # Create SQL script
    cat > /tmp/create_pgvector.sql << EOF
-- Create pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check version
SELECT extversion FROM pg_extension WHERE extname = 'vector';
EOF

    # Execute SQL script
    sudo -u postgres psql -d "$DB_NAME" -f /tmp/create_pgvector.sql

    if [ $? -eq 0 ]; then
        print_success "pgvector extension created successfully in database $DB_NAME"
    else
        print_error "Failed to create pgvector extension"
        exit 1
    fi
}

# Main execution
main() {
    echo ""
    print_info "Step 1: Installing pgvector..."
    install_pgvector

    echo ""
    print_info "Step 2: Creating extension in database..."
    create_extension

    echo ""
    print_success "pgvector setup completed successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Run 'npm install' to install the pgvector Node.js client"
    echo "2. Restart your PostgreSQL server if needed"
    echo "3. Run the migration script: node scripts/migrate-embeddings.js"
    echo ""
}

# Run main function
main