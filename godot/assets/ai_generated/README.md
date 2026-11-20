# AI-generated assets (drop zone)

Put the files generated with Meshy / Blockade Labs here. Nothing else needs to change in code.

| Asset | File | Where it plugs in |
|---|---|---|
| 360 sky | `sky.hdr` (or .exr) | Picked automatically by `SkyController` on the `WorldEnvironment` node of `world.tscn`. Or drag any texture into `sky_texture`. |
| Truck | e.g. `truck.glb` | `Truck` node (`vehicles/truck.tscn`) -> `truck_mesh_scene`. Tune `truck_model_scale`, `truck_model_offset`, `truck_model_yaw_deg`. If the glb has nodes named `WheelFL/WheelFR/WheelRL/WheelRR` they are attached to the physics wheels (they steer and spin). |
| Tree | e.g. `tree.glb` | `Decorator` node (`world/world.tscn`) -> `tree_scene` |
| Grass | e.g. `grass.glb` | `Decorator` node -> `grass_scene` |
| Warehouse etc. | `*.glb` | Replace the meshes under `world/warehouse.tscn` (keep the collision nodes). |

Conventions for the truck model: origin at ground level, centred between the axles, front looking toward -Z
(use `truck_model_yaw_deg = 180` if your model faces +Z), about 4.8 m long x 2.2 m wide x 2.3 m high
(use `truck_model_scale` to fit).
