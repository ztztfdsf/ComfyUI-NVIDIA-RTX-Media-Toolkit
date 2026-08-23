# -*- coding: utf-8 -*-
"""Locate the NVIDIA NGX core (_nvngx.dll) and manage the DLISR snippet/model files.

Resolution order (user environment first, bundled fallback second):

_nvngx.dll (NGX core, ships with the driver):
  1. Registry  HKLM\\SOFTWARE\\NVIDIA Corporation\\Global\\NGXCore\\FullPath
  2. DriverStore: C:\\Windows\\System32\\DriverStore\\FileRepository\\nv_dispsi.inf_*\\_nvngx.dll
  3. C:\\Windows\\System32\\_nvngx.dll

DLISR snippet (signed model container, 160_<appid>.bin):
  1. Already installed in the NGX cache (C:\\ProgramData\\NVIDIA\\NGX\\models\\dlisr\\...)
  2. Re-use an existing OTA snippet from the local NGX cache (models\\dlisp\\versions\\*\\files\\160_*.bin)
  3. Bundled copy in <package>/models/dlisr/160_0000000.bin
  4. Download from GitHub (same repo) into the bundled folder, then install

The NGX cache directory is NVIDIA's own world-writable cache (the driver creates it
with an open ACL); installing the snippet there only adds files, never overwrites
driver components.
"""

import glob
import os
import shutil

PACKAGE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BUNDLED_MODEL_DIR = os.path.join(PACKAGE_DIR, "models", "dlisr")
BUNDLED_SNIPPET = os.path.join(BUNDLED_MODEL_DIR, "160_0000000.bin")

NGX_MODELS_DIR = os.path.join(os.environ.get("ProgramData", r"C:\ProgramData"),
                              "NVIDIA", "NGX", "models")
DLISR_CACHE_DIR = os.path.join(NGX_MODELS_DIR, "dlisr", "versions")
DLISR_CONFIG = os.path.join(NGX_MODELS_DIR, "nvngx_config.txt")

# NGX app id used by NVIDIA App for DLISR (registered in the OTA config as 310.0.0)
DLISR_APPID = 0xE658703
DLISR_APPID_DEC = 241534723  # decimal form of DLISR_APPID

SNIPPET_DOWNLOAD_URLS = [
    "https://raw.githubusercontent.com/ztztfdsf/ComfyUI-NVIDIA-RTX-Media-Toolkit/main/models/dlisr/160_0000000.bin",
    "https://ghproxy.net/https://raw.githubusercontent.com/ztztfdsf/ComfyUI-NVIDIA-RTX-Media-Toolkit/main/models/dlisr/160_0000000.bin",
]

_config_patched = False
_nvngx_path = None


# ---------------------------------------------------------------------------
# NGX core discovery
# ---------------------------------------------------------------------------

def _from_registry():
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                             r"SOFTWARE\NVIDIA Corporation\Global\NGXCore")
        path, _ = winreg.QueryValueEx(key, "FullPath")
        winreg.CloseKey(key)
        if path and os.path.isdir(path):
            p = os.path.join(path, "_nvngx.dll")
            if os.path.isfile(p):
                return p, path  # dll, containing dir (snippet search path)
    except OSError:
        pass
    return None, None


def _from_driverstore():
    root = os.path.join(os.environ.get("SystemRoot", r"C:\Windows"),
                        "System32", "DriverStore", "FileRepository")
    for pat in ("nv_dispsi.inf_amd64_*", "nv_dispi.inf_amd64_*"):
        for d in glob.glob(os.path.join(root, pat)):
            p = os.path.join(d, "_nvngx.dll")
            if os.path.isfile(p):
                return p, d
    return None, None


def _from_system32():
    p = os.path.join(os.environ.get("SystemRoot", r"C:\Windows"),
                     "System32", "_nvngx.dll")
    if os.path.isfile(p):
        return p, os.path.dirname(p)
    return None, None


def find_nvngx():
    """Return (dll_path, containing_dir) for the NGX core, or (None, None)."""
    global _nvngx_path
    if _nvngx_path:
        return _nvngx_path, os.path.dirname(_nvngx_path)
    for finder in (_from_registry, _from_driverstore, _from_system32):
        dll, d = finder()
        if dll:
            _nvngx_path = dll
            return dll, d
    return None, None


# ---------------------------------------------------------------------------
# DLISR snippet installation
# ---------------------------------------------------------------------------

def _config_has_dlisr():
    try:
        with open(DLISR_CONFIG, "r", encoding="utf-8", errors="ignore") as f:
            return "[dlisr]" in f.read().lower()
    except OSError:
        return False


def _install_config():
    """Append a [dlisr] section to nvngx_config.txt (idempotent, keeps a backup)."""
    global _config_patched
    if _config_patched or _config_has_dlisr():
        _config_patched = True
        return True
    os.makedirs(NGX_MODELS_DIR, exist_ok=True)
    bak = DLISR_CONFIG + ".nvvfx-bak"
    if os.path.isfile(DLISR_CONFIG) and not os.path.isfile(bak):
        try:
            shutil.copy2(DLISR_CONFIG, bak)
        except OSError:
            pass
    try:
        with open(DLISR_CONFIG, "a", encoding="utf-8") as f:
            f.write("\n[dlisr]\napp_%07X = 310.0.0\napp_0000000 = 310.0.0\n" % DLISR_APPID)
        _config_patched = True
        return True
    except OSError as e:
        raise RuntimeError(
            f"Cannot write NGX config ({DLISR_CONFIG}): {e}\n"
            "Try running ComfyUI once as Administrator so the DLISR snippet can be "
            "registered, or create the [dlisr] section manually.") from e


def _cache_snippet_paths():
    """All snippet file names NGX may request, in every cache version dir we use."""
    names = ["160_0000000.bin", "160_%07X.bin" % DLISR_APPID]
    paths = []
    for ver in ("0", str(DLISR_APPID_DEC)):
        d = os.path.join(DLISR_CACHE_DIR, ver, "files")
        for n in names:
            paths.append(os.path.join(d, n))
    return paths


def _cache_ok():
    """True if the primary snippet NGX loads (versions/0/files/160_0000000.bin) exists."""
    return os.path.isfile(os.path.join(DLISR_CACHE_DIR, "0", "files", "160_0000000.bin"))


def _copy_snippet_into_cache(src_bin):
    """Install one snippet file under every name/location NGX may probe."""
    os.makedirs(os.path.join(DLISR_CACHE_DIR, "0", "files"), exist_ok=True)
    os.makedirs(os.path.join(DLISR_CACHE_DIR, str(DLISR_APPID_DEC), "files"), exist_ok=True)
    for p in _cache_snippet_paths():
        if not os.path.isfile(p):
            shutil.copy2(src_bin, p)


def _reuse_ota_snippet():
    """Some NVIDIA App installs already ship DLISR snippets under models/dlisp."""
    pats = [os.path.join(NGX_MODELS_DIR, "dlisp", "versions", "*", "files", "160_*.bin"),
            os.path.join(NGX_MODELS_DIR, "dlisr", "versions", "*", "files", "160_*.bin")]
    for pat in pats:
        for p in sorted(glob.glob(pat)):
            if os.path.getsize(p) > 1_000_000:
                return p
    return None


def _download_snippet(dst):
    import urllib.request
    last_err = None
    for url in SNIPPET_DOWNLOAD_URLS:
        try:
            print(f"[RTX-Media-Toolkit] Downloading DLISR snippet ({os.path.getsize(dst)//1024 if os.path.exists(dst) else 4100} KB expected) ...")
            urllib.request.urlretrieve(url, dst)
            if os.path.isfile(dst) and os.path.getsize(dst) > 1_000_000:
                return dst
        except Exception as e:  # noqa: BLE001
            last_err = e
    raise RuntimeError(f"DLISR snippet download failed: {last_err}")


def ensure_dlisr_snippet():
    """Make sure the DLISR snippet is installed in the NGX cache and config registered.

    Returns the path of the primary installed snippet."""
    if _cache_ok() and _config_has_dlisr():
        return os.path.join(DLISR_CACHE_DIR, "0", "files", "160_0000000.bin")

    src = None
    if os.path.isfile(BUNDLED_SNIPPET):
        src = BUNDLED_SNIPPET
    else:
        # user environment first: maybe NVIDIA App OTA already delivered one
        src = _reuse_ota_snippet()
        if src is None:
            os.makedirs(BUNDLED_MODEL_DIR, exist_ok=True)
            src = _download_snippet(BUNDLED_SNIPPET)

    _copy_snippet_into_cache(src)
    _install_config()
    return os.path.join(DLISR_CACHE_DIR, "0", "files", "160_0000000.bin")


def setup_all():
    """Locate the NGX core and install the DLISR snippet. Returns (dll, snippet)."""
    dll, _ = find_nvngx()
    if not dll:
        raise RuntimeError(
            "NVIDIA NGX core (_nvngx.dll) not found. It ships with GeForce drivers "
            "470+. Update your NVIDIA driver and reload.")
    snippet = ensure_dlisr_snippet()
    return dll, snippet
