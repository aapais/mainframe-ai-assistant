#!/usr/bin/env python3
"""
GitHub Spec Kit - Constitution Command
Updates and manages project governance principles
"""

import os
import sys
from datetime import datetime
from pathlib import Path

def update_constitution(update_description=None):
    """Update project constitution"""
    
    constitution_file = Path("memory/constitution.md")
    
    if not constitution_file.exists():
        print("❌ Constitution file not found at memory/constitution.md")
        return None
    
    # Read current constitution
    with open(constitution_file, "r", encoding="utf-8") as f:
        current_content = f.read()
    
    if update_description:
        print(f"📝 Current constitution loaded from: {constitution_file}")
        print(f"🎯 Update request: {update_description}")
        print("\n📋 Current Constitution:")
        print("=" * 50)
        print(current_content)
        print("=" * 50)
        print(f"\n⚠️  Constitution updates require careful review and team approval.")
        print(f"Please review the current constitution and propose specific changes.")
    else:
        print(f"📝 Constitution loaded from: {constitution_file}")
        print("\n📋 Current Constitution:")
        print("=" * 50)
        print(current_content)
        print("=" * 50)
    
    return str(constitution_file)

def main():
    update_request = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else None
    return update_constitution(update_request)

if __name__ == "__main__":
    main()
