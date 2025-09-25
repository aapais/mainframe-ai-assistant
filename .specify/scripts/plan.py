#!/usr/bin/env python3
"""
GitHub Spec Kit - Plan Command
Generates technical implementation plans from specifications
"""

import os
import sys
import json
from datetime import datetime
from pathlib import Path
import re

def create_implementation_plan(tech_description, spec_path=None):
    """Create technical implementation plan"""
    
    if spec_path:
        # Use existing spec directory
        feature_dir = Path(spec_path).parent
    else:
        # Find latest spec
        specs_dir = Path("specs")
        if not specs_dir.exists():
            print("❌ No specs directory found. Run `/specify` first.")
            return None
            
        spec_dirs = [d for d in specs_dir.iterdir() if d.is_dir()]
        if not spec_dirs:
            print("❌ No feature specs found. Run `/specify` first.")
            return None
            
        feature_dir = max(spec_dirs, key=lambda x: x.name)
    
    # Load plan template
    with open("templates/plan-template.md", "r", encoding="utf-8") as f:
        template = f.read()
    
    # Get feature info
    feature_name = feature_dir.name
    
    # Replace template variables
    plan_content = template.replace("[FEATURE NAME]", feature_name.replace("-", " ").title())
    plan_content = plan_content.replace("[FEATURE-BRANCH]", feature_name)
    plan_content = plan_content.replace("[DATE]", datetime.now().strftime("%Y-%m-%d"))
    plan_content = plan_content.replace("$ARGUMENTS", tech_description)
    
    # Write plan file
    plan_file = feature_dir / "plan.md"
    with open(plan_file, "w", encoding="utf-8") as f:
        f.write(plan_content)
    
    print(f"✅ Created implementation plan: {plan_file}")
    print(f"📁 Feature directory: {feature_dir}")
    print(f"\n🎯 Next steps:")
    print(f"1. Review and refine the technical plan")
    print(f"2. Run `/tasks` to generate executable task breakdown")
    print(f"3. Use `/implement {plan_file}` to execute the plan")
    
    return str(plan_file)

def main():
    if len(sys.argv) < 2:
        print("Usage: python plan.py 'Technical implementation description'")
        sys.exit(1)
    
    tech_description = " ".join(sys.argv[1:])
    return create_implementation_plan(tech_description)

if __name__ == "__main__":
    main()
