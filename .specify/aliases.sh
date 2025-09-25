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
