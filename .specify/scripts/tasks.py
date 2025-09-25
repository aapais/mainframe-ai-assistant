#!/usr/bin/env python3
"""
GitHub Spec Kit - Tasks Command
Generates executable task breakdown from implementation plans
"""

import os
import sys
from datetime import datetime
from pathlib import Path

def create_task_breakdown(feature_dir=None):
    """Create task breakdown from existing plan"""
    
    if feature_dir:
        feature_dir = Path(feature_dir)
    else:
        # Find latest spec with plan
        specs_dir = Path("specs")
        if not specs_dir.exists():
            print("❌ No specs directory found. Run `/specify` and `/plan` first.")
            return None
            
        spec_dirs = [d for d in specs_dir.iterdir() if d.is_dir() and (d / "plan.md").exists()]
        if not spec_dirs:
            print("❌ No implementation plans found. Run `/plan` first.")
            return None
            
        feature_dir = max(spec_dirs, key=lambda x: x.name)
    
    # Check if plan exists
    plan_file = feature_dir / "plan.md"
    if not plan_file.exists():
        print(f"❌ No plan.md found in {feature_dir}. Run `/plan` first.")
        return None
    
    # Load tasks template
    with open("templates/tasks-template.md", "r", encoding="utf-8") as f:
        template = f.read()
    
    # Get feature info
    feature_name = feature_dir.name
    
    # Replace template variables
    tasks_content = template.replace("[FEATURE NAME]", feature_name.replace("-", " ").title())
    tasks_content = tasks_content.replace("[FEATURE-BRANCH]", feature_name)
    tasks_content = tasks_content.replace("[DATE]", datetime.now().strftime("%Y-%m-%d"))
    
    # Write tasks file
    tasks_file = feature_dir / "tasks.md"
    with open(tasks_file, "w", encoding="utf-8") as f:
        f.write(tasks_content)
    
    print(f"✅ Created task breakdown: {tasks_file}")
    print(f"📁 Feature directory: {feature_dir}")
    print(f"\n🎯 Next steps:")
    print(f"1. Review and prioritize the task breakdown")
    print(f"2. Use TDD approach: Write tests first")
    print(f"3. Execute with `/implement {feature_dir}/plan.md`")
    
    return str(tasks_file)

def main():
    feature_path = sys.argv[1] if len(sys.argv) > 1 else None
    return create_task_breakdown(feature_path)

if __name__ == "__main__":
    main()
