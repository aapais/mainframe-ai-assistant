#!/usr/bin/env python3
"""
GitHub Spec Kit - Specify Command
Generates feature specifications from user descriptions
"""

import os
import sys
import json
import re
from datetime import datetime
from pathlib import Path

def create_feature_spec(description):
    """Create a new feature specification"""
    
    # Generate feature number and name
    specs_dir = Path("specs")
    existing_specs = [d for d in specs_dir.iterdir() if d.is_dir() and d.name.startswith(("001", "002", "003", "004", "005", "006", "007", "008", "009"))]
    next_number = f"{len(existing_specs) + 1:03d}"
    
    # Create feature name from description
    feature_name = re.sub(r'[^\w\s-]', '', description.lower())
    feature_name = re.sub(r'[-\s]+', '-', feature_name)[:50]
    feature_dir = specs_dir / f"{next_number}-{feature_name}"
    
    # Create feature directory
    feature_dir.mkdir(parents=True, exist_ok=True)
    
    # Load spec template
    with open("templates/spec-template.md", "r", encoding="utf-8") as f:
        template = f.read()
    
    # Replace template variables
    spec_content = template.replace("[FEATURE NAME]", description.title())
    spec_content = spec_content.replace("[###-feature-name]", f"{next_number}-{feature_name}")
    spec_content = spec_content.replace("[DATE]", datetime.now().strftime("%Y-%m-%d"))
    spec_content = spec_content.replace("$ARGUMENTS", description)
    
    # Write spec file
    spec_file = feature_dir / "spec.md"
    with open(spec_file, "w", encoding="utf-8") as f:
        f.write(spec_content)
    
    print(f"✅ Created feature specification: {spec_file}")
    print(f"📁 Feature directory: {feature_dir}")
    print(f"\n🎯 Next steps:")
    print(f"1. Review and refine the specification")
    print(f"2. Run `/plan` to create technical implementation plan")
    print(f"3. Use `/tasks` to generate executable tasks")
    
    return str(spec_file)

def main():
    if len(sys.argv) < 2:
        print("Usage: python specify.py 'Feature description'")
        sys.exit(1)
    
    description = " ".join(sys.argv[1:])
    return create_feature_spec(description)

if __name__ == "__main__":
    main()
