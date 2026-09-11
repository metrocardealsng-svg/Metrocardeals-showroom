"""One-time media import; every file must match the original site."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib,json,time,urllib.request
ROOT=Path(__file__).resolve().parents[1]
ORIGIN="https://metrocardeals-showroom.metrocardealsng.chatgpt.site"
def import_file(item):
    relative=item["path"]
    if not relative.startswith(("public/assets/","public/vendor/")) or ".." in Path(relative).parts:
        raise ValueError("Invalid asset path")
    target=ROOT/relative
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()==item["sha256"]: return
    url=ORIGIN+"/"+relative.removeprefix("public/")
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url,timeout=60) as response: data=response.read()
            if hashlib.sha256(data).hexdigest()!=item["sha256"]: raise ValueError("Checksum mismatch: "+relative)
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(data)
            return
        except Exception:
            if attempt==2: raise
            time.sleep(2)
items=json.loads((ROOT/"scripts/asset-manifest.json").read_text())
with ThreadPoolExecutor(max_workers=6) as pool: list(pool.map(import_file,items))
print("Verified and imported",len(items),"assets")
