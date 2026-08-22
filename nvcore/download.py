# -*- coding: utf-8 -*-
"""Download / extract NVIDIA Video Effects SDK per-architecture model packages.

The SDK is distributed by NVIDIA as per-architecture NSIS installers on the
public CDN. Each installer contains the runtime DLLs plus precompiled TensorRT
engine packages (`.engine.trtpkg`) for that GPU architecture. We download the
installer for the detected GPU, extract only what we need (DLLs + SR engines)
into this package's `bin/<sm>/` folder, and use the bundled 7-Zip (or any
system 7z) to unpack the NSIS archive.
"""

import os
import shutil
import subprocess
import urllib.request

from . import common

NEEDED_DLLS = [
    "NVVideoEffects.dll", "NVCVImage.dll",
    "nvinfer_10.dll", "nvinfer_plugin_10.dll", "nvonnxparser_10.dll",
    "nppc64_12.dll", "nppial64_12.dll", "nppicc64_12.dll", "nppidei64_12.dll",
    "nppif64_12.dll", "nppig64_12.dll", "nppim64_12.dll", "nppist64_12.dll",
    "nppitc64_12.dll",
    "cudart64_12.dll", "cublas64_12.dll", "cublasLt64_12.dll",
    "nvrtc64_120_0.dll", "nvrtc-builtins64_121.dll", "libcrypto-3-x64.dll",
]

CDN_EXE_NAME = "nvidia_video_effects_sdk_installer_v{v}_{a}.exe"
DOWNLOAD_DIR = os.path.join(common.PACKAGE_DIR, "_downloads")


def sdk_url(arch_name):
    return common.CDN_URL.format(ver=common.SDK_VERSION, arch=arch_name)


def _find_7z():
    cands = [
        os.path.join(os.environ.get("ProgramFiles", ""), "7-Zip", "7z.exe"),
        os.path.join(os.environ.get("ProgramW6432", ""), "7-Zip", "7z.exe"),
        os.path.join(os.environ.get("ProgramFiles(x86)", ""), "7-Zip", "7z.exe"),
        r"C:\Program Files\NVIDIA Corporation\NVIDIA app\7z.exe",
    ]
    for c in cands:
        if c and os.path.isfile(c):
            return c
    p = shutil.which("7z") or shutil.which("7za")
    return p


def models_present(sm):
    d = os.path.join(common.BIN_ROOT, sm, "models")
    if not os.path.isdir(d):
        return False
    return any(f.startswith("SR_") for f in os.listdir(d))


def download_sdk(sm=None, progress=print):
    """Ensure the SDK runtime + SR engines for the current GPU are installed
    under bin/<sm>/. Downloads from NVIDIA CDN if missing."""
    info = common.arch_info() if sm is None else None
    if info is not None:
        sm = info["sm"]
    arch_name = info["installer"] if info else _sm_to_installer(sm)

    if models_present(sm):
        return {"status": "ok", "message": f"SDK models for {sm} already installed."}

    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    exe_path = os.path.join(DOWNLOAD_DIR, CDN_EXE_NAME.format(v=common.SDK_VERSION, a=arch_name))
    url = sdk_url(arch_name)

    if not os.path.isfile(exe_path) or os.path.getsize(exe_path) < 700_000_000:
        progress(f"[NVVFX-Pro] Downloading NVIDIA VFX SDK {common.SDK_VERSION} for {arch_name} "
                 f"({url}) ... this is ~750 MB, one time only.")
        _download_resume(url, exe_path, progress)

    progress(f"[NVVFX-Pro] Extracting SDK package with 7-Zip ...")
    tmp = os.path.join(DOWNLOAD_DIR, f"extract_{arch_name}")
    if os.path.isdir(tmp):
        shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp, exist_ok=True)
    sz = _find_7z()
    if not sz:
        raise RuntimeError(
            "7-Zip not found. Please install 7-Zip (https://www.7-zip.org/) so the "
            "NVIDIA SDK package can be extracted automatically.")
    r = subprocess.run([sz, "e", "-y", f"-o{tmp}", exe_path], capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(f"7-Zip extraction failed: {r.stderr.decode(errors='ignore')[-400:]}")

    target = os.path.join(common.BIN_ROOT, sm)
    os.makedirs(os.path.join(target, "models"), exist_ok=True)
    for f in NEEDED_DLLS:
        src = os.path.join(tmp, f)
        if os.path.isfile(src):
            shutil.copy2(src, os.path.join(target, f))
    engines = [f for f in os.listdir(tmp) if f.startswith("SR_") and f.endswith(".engine.trtpkg")]
    for f in engines:
        src = os.path.join(tmp, f)
        shutil.copy2(src, os.path.join(target, "models", f))
        shutil.copy2(src, os.path.join(target, "models", f[: -len(".trtpkg")]))
    shutil.rmtree(tmp, ignore_errors=True)
    if not engines:
        raise RuntimeError("Extraction produced no SR engine files; cannot continue.")
    return {"status": "ok", "message": f"SDK engines installed for {sm} ({len(engines)} SR models)."}


def _sm_to_installer(sm):
    for (cc, (s, installer, _label)) in common.ARCH_TABLE.items():
        if s == sm:
            return installer
    raise RuntimeError(f"No SDK package for {sm}")


def _download_resume(url, path, progress):
    """Download with resume support, reporting progress."""
    tmp = path + ".part"
    headers = {"User-Agent": "Mozilla/5.0"}
    mode = "ab"
    have = os.path.getsize(tmp) if os.path.isfile(tmp) else 0
    if have:
        headers["Range"] = f"bytes={have}-"
    else:
        mode = "wb"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=60) as resp, open(tmp, mode) as out:
        total = have + int(resp.headers.get("Content-Length") or 0)
        done = have
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            out.write(chunk)
            done += len(chunk)
            if total:
                pct = done * 100 // total
                if pct % 10 == 0:
                    progress(f"[NVVFX-Pro] download {pct}% ({done // 1048576} / {total // 1048576} MB)")
    os.replace(tmp, path)
    progress(f"[NVVFX-Pro] download complete: {os.path.getsize(path) // 1048576} MB")
