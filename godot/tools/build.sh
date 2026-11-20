#!/usr/bin/env bash
# Regenerate all scenes (run from the godot/ directory).
set -e
godot --headless --path . --import >/dev/null 2>&1 || true
godot --headless --path . res://tools/build_scenes.tscn 2>&1 | grep -v "^Godot Engine" 
