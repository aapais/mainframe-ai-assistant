#!/usr/bin/env python3
"""
GitHub Spec Kit - Implement Command
Executes implementation plans with TDD approach
"""

import os
import sys
from datetime import datetime
from pathlib import Path

def implement_plan(plan_path):
    """Execute implementation plan"""
    
    plan_file = Path(plan_path)
    if not plan_file.exists():
        print(f"❌ Plan file not found: {plan_path}")
        return None
    
    feature_dir = plan_file.parent
    
    # Read plan content
    with open(plan_file, "r", encoding="utf-8") as f:
        plan_content = f.read()
    
    print(f"🚀 Starting implementation of: {feature_dir.name}")
    print(f"📋 Plan file: {plan_file}")
    print("\n" + "=" * 60)
    print("IMPLEMENTATION PLAN")
    print("=" * 60)
    print(plan_content)
    print("=" * 60)
    
    # Check for tasks file
    tasks_file = feature_dir / "tasks.md"
    if tasks_file.exists():
        print(f"\n📝 Task breakdown available: {tasks_file}")
        with open(tasks_file, "r", encoding="utf-8") as f:
            tasks_content = f.read()
        print("\n" + "=" * 60)
        print("TASK BREAKDOWN")
        print("=" * 60)
        print(tasks_content)
        print("=" * 60)
    else:
        print(f"\n⚠️  No task breakdown found. Run `/tasks` first for detailed task list.")
    
    print(f"\n🎯 Ready for implementation!")
    print(f"📁 Working directory: {feature_dir}")
    print(f"\n✅ TDD Approach:")
    print(f"   1. Write tests first (RED)")
    print(f"   2. Implement minimal code to pass (GREEN)")
    print(f"   3. Refactor and optimize (REFACTOR)")
    print(f"\n🔧 Constitution compliance:")
    print(f"   - Follow security-first principles")
    print(f"   - Ensure cross-platform compatibility")
    print(f"   - Maintain <2s response times")
    print(f"   - Document all API endpoints")
    
    return str(plan_file)

def main():
    if len(sys.argv) < 2:
        print("Usage: python implement.py path/to/plan.md")
        sys.exit(1)
    
    plan_path = sys.argv[1]
    return implement_plan(plan_path)

if __name__ == "__main__":
    main()
