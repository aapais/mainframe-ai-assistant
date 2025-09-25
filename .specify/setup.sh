#!/bin/bash
# GitHub Spec Kit Integration Script
# Makes Spec Kit commands available in Claude Code CLI

# Create command aliases for easy access
echo "Setting up GitHub Spec Kit commands..."

# Ensure Python scripts are executable
chmod +x .specify/scripts/*.py

# Create shell aliases (add to your ~/.bashrc or ~/.zshrc)
cat << 'EOF' > .specify/aliases.sh
# GitHub Spec Kit Command Aliases

alias specify='python3 .specify/scripts/specify.py'
alias plan='python3 .specify/scripts/plan.py' 
alias tasks='python3 .specify/scripts/tasks.py'
alias constitution='python3 .specify/scripts/constitution.py'
alias implement='python3 .specify/scripts/implement.py'

# Alternative commands with full paths
alias spec-specify='python3 "$(pwd)/.specify/scripts/specify.py"'
alias spec-plan='python3 "$(pwd)/.specify/scripts/plan.py"'
alias spec-tasks='python3 "$(pwd)/.specify/scripts/tasks.py"'  
alias spec-constitution='python3 "$(pwd)/.specify/scripts/constitution.py"'
alias spec-implement='python3 "$(pwd)/.specify/scripts/implement.py"'

echo "✅ GitHub Spec Kit commands loaded!"
echo "Available commands: specify, plan, tasks, constitution, implement"
EOF

# Source the aliases
source .specify/aliases.sh

echo "🎉 GitHub Spec Kit integration completed!"
echo ""
echo "📋 Available Commands:"
echo "  specify 'Feature description'     - Create feature specification"
echo "  plan 'Technical implementation'   - Generate implementation plan"
echo "  tasks                            - Create task breakdown"
echo "  constitution                     - View/update project constitution"  
echo "  implement specs/001-feature/plan.md - Execute implementation"
echo ""
echo "🚀 Usage Example:"
echo "  specify 'User authentication system with JWT tokens'"
echo "  plan 'Node.js Express API with PostgreSQL database'"
echo "  tasks"
echo "  implement specs/001-user-authentication-system-with-jwt-tokens/plan.md"
echo ""
echo "💡 To make aliases permanent, add this to your shell profile:"
echo "  echo 'source $(pwd)/.specify/aliases.sh' >> ~/.bashrc"
