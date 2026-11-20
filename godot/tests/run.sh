#!/usr/bin/env bash
# Usage: tests/run.sh phase1   (run from godot/)
set -e
name=$1
cat > "tests/_run_$name.tscn" <<T
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://tests/test_$name.gd" id="1"]

[node name="Test" type="Node"]
script = ExtResource("1")
T
godot --headless --path . "res://tests/_run_$name.tscn" 2>&1 | grep -v "^Godot Engine"
rm -f "tests/_run_$name.tscn"
