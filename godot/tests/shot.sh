#!/usr/bin/env bash
# Usage: tests/shot.sh out.png "camx,camy,camz" "lookx,looky,lookz" [extra args like hud=0]
out=$1; cam=$2; look=$3; shift 3
export VK_ICD_FILENAMES=/opt/lavapipe/lvp_icd.json
xvfb-run -a -s "-screen 0 1280x720x24" godot --path . --rendering-driver vulkan --resolution 1280x720 res://tests/shot.tscn -- out=$out cam=$cam look=$look "$@" 2>&1 | grep -vE "^Godot Engine|^Vulkan|^Found|^\s*$" | tail -15
