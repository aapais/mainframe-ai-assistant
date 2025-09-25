#!/usr/bin/env python3
"""
GitHub Spec Kit - Health Check
Verifies the installation and configuration
"""

import os
import sys
from pathlib import Path

def check_installation():
    """Verify Spec Kit installation and configuration"""
    
    print("🔍 GitHub Spec Kit - Health Check")
    print("=" * 50)
    
    # Check project structure
    checks = [
        ("📁 .specify directory", Path(".specify").exists()),
        ("📁 scripts directory", Path(".specify/scripts").exists()),
        ("📁 specs directory", Path("specs").exists()),  
        ("📁 templates directory", Path("templates").exists()),
        ("📁 memory directory", Path("memory").exists()),
        ("📄 CLAUDE.md", Path("CLAUDE.md").exists()),
        ("📄 constitution.md", Path("memory/constitution.md").exists()),
    ]
    
    # Check scripts
    scripts = [
        "specify.py",
        "plan.py", 
        "tasks.py",
        "constitution.py",
        "implement.py"
    ]
    
    for script in scripts:
        script_path = Path(f".specify/scripts/{script}")
        checks.append((f"🐍 {script}", script_path.exists()))
    
    # Check templates
    templates = [
        "spec-template.md",
        "plan-template.md",
        "tasks-template.md"
    ]
    
    for template in templates:
        template_path = Path(f"templates/{template}")
        checks.append((f"📝 {template}", template_path.exists()))
    
    # Display results
    all_good = True
    for name, status in checks:
        icon = "✅" if status else "❌"
        print(f"{icon} {name}")
        if not status:
            all_good = False
    
    print("=" * 50)
    
    if all_good:
        print("🎉 All checks passed! GitHub Spec Kit is ready.")
        print("\n🚀 Quick Start:")
        print("   specify 'Your feature description here'")
        print("   plan 'Your technical approach here'")  
        print("   tasks")
        print("   implement specs/001-*/plan.md")
        
        print("\n💡 See SPEC_KIT_README.md for detailed usage guide")
        return True
    else:
        print("❌ Some components are missing. Please check the installation.")
        return False

def main():
    return check_installation()

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
