#!/usr/bin/env python3
"""Downloads the CC0 assets used by the prototype (run from godot/).
Sources: Poly Haven (HDRI + models, CC0), ambientCG (PBR textures, CC0),
OpenGameArt "3D Vehicles Pack" by Inborn Ninja / mehrasaur (CC0, already vendored in assets/models/trucks)."""
import io, json, os, sys, urllib.request, zipfile

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "stock-runner-asset-fetch"})
    return urllib.request.urlopen(req, timeout=120).read()

def save(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "wb").write(data)

# --- HDRI -------------------------------------------------------------------
hdri = json.loads(get("https://api.polyhaven.com/files/kloofendal_43d_clear_puresky"))
save("assets/hdri/kloofendal_43d_clear_puresky_2k.hdr", get(hdri["hdri"]["2k"]["hdr"]["url"]))

# --- ambientCG PBR textures (Color + NormalGL + Roughness [+ AO]) -----------
textures = {
    "asphalt": "Asphalt031", "concrete": "Concrete034", "brick": "Bricks059",
    "metal_rust": "Rust005", "corrugated": "CorrugatedSteel005", "wood": "Planks021",
    "grass": "Grass004",
}
for name, cid in textures.items():
    try:
        z = zipfile.ZipFile(io.BytesIO(get(f"https://ambientcg.com/get?file={cid}_1K-JPG.zip")))
    except Exception as ex:
        print("SKIP", name, cid, ex); continue
    for member in z.namelist():
        for suffix, out in (("_Color.jpg", "albedo"), ("_NormalGL.jpg", "normal"), ("_Roughness.jpg", "roughness")):
            if member.endswith(suffix):
                save(f"assets/textures/{name}/{out}.jpg", z.read(member))
    print("ok", name, cid)

# --- Poly Haven models (glTF 1k) --------------------------------------------
models = ["wooden_crate_01", "barrel_03", "steel_frame_shelves_01", "concrete_road_barrier_02", "old_tyre",
          "utility_box_01", "metal_jerrycan_green", "rollershutter_door", "cement_bag", "Shelf_01"]
for mid in models:
    try:
        files = json.loads(get(f"https://api.polyhaven.com/files/{mid}"))["gltf"]["1k"]["gltf"]
    except Exception as ex:
        print("SKIP", mid, ex); continue
    base = f"assets/models/polyhaven/{mid}/"
    save(base + f"{mid}.gltf", get(files["url"]))
    for rel, info in files.get("include", {}).items():
        save(base + rel, get(info["url"]))
    print("ok", mid)
