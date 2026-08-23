# -*- coding: utf-8 -*-
"""Shared paths / environment setup for RTX Media Toolkit."""

import ctypes
import glob
import os
import sys

PACKAGE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BIN_ROOT = os.path.join(PACKAGE_DIR, "bin")
RIFE_DIR = os.path.join(PACKAGE_DIR, "rife")
RIFE_MODEL = os.path.join(RIFE_DIR, "rife49.onnx")

# compute capability -> (arch name, sdk installer name, engine suffix)
ARCH_TABLE = {
    (7, 5):  ("sm_75",  "turing",   "RTX 20 series (Turing)"),
    (8, 6):  ("sm_86",  "ampere",   "RTX 30 series (Ampere)"),
    (8, 9):  ("sm_89",  "ada",      "RTX 40 series (Ada)"),
    (12, 0): ("sm_120", "blackwell", "RTX 50 series (Blackwell)"),
}

SDK_VERSION = "0.7.6"
CDN_URL = ("https://international.download.nvidia.com/Windows/broadcast/sdk/VFX/"
           "nvidia_video_effects_sdk_installer_v{ver}_{arch}.exe")


def detect_cc():
    import torch
    if not torch.cuda.is_available():
        raise RuntimeError("No CUDA GPU detected. NVIDIA RTX VSR requires an NVIDIA RTX GPU.")
    return torch.cuda.get_device_capability(0)


def arch_info():
    cc = detect_cc()
    if cc not in ARCH_TABLE:
        raise RuntimeError(
            f"GPU compute capability {cc[0]}.{cc[1]} is not supported by the NVIDIA "
            f"Video Effects SDK 0.7.6. Supported: RTX 20/30/40/50 series.")
    sm, installer, label = ARCH_TABLE[cc]
    return {"cc": cc, "sm": sm, "installer": installer, "label": label}


def arch_bin_dir(sm=None):
    info = arch_info() if sm is None else {"sm": sm}
    return os.path.join(BIN_ROOT, info["sm"])


def _find_dll(name, dirs):
    for d in dirs:
        p = os.path.join(d, name)
        if os.path.exists(p):
            return p
    return None


_NV_DLL_DIRS = None


def nvidia_dll_dirs():
    """Directories that may contain CUDA runtime DLLs needed by onnxruntime CUDA EP."""
    global _NV_DLL_DIRS
    if _NV_DLL_DIRS is not None:
        return _NV_DLL_DIRS
    dirs = []
    for pat in [
        os.path.join(sys.prefix, "Lib", "site-packages", "nvidia", "*", "bin"),
        os.path.join(sys.prefix, "Lib", "site-packages", "torch", "lib"),
        os.path.join(sys.prefix, "Lib", "site-packages", "torch", "bin"),
    ]:
        dirs += glob.glob(pat)
    dirs = list(dict.fromkeys(dirs))
    _NV_DLL_DIRS = dirs
    return dirs


def preload_ort_cuda_deps():
    """Preload CUDA runtime DLLs so onnxruntime's CUDA Execution Provider can load.
    onnxruntime 1.23.x is built for CUDA 12 and searches restricted paths, so we
    load its dependencies into the process beforehand."""
    need = ["cudart64_12.dll", "cublasLt64_12.dll", "cublas64_12.dll",
            "cufft64_11.dll", "cufft64_10.dll", "cudnn64_9.dll"]
    search = nvidia_dll_dirs() + [BIN_ROOT]
    for sm in os.listdir(BIN_ROOT) if os.path.isdir(BIN_ROOT) else []:
        d = os.path.join(BIN_ROOT, sm)
        if os.path.isdir(d):
            search.append(d)
    loaded = []
    for name in need:
        p = _find_dll(name, search)
        if p:
            try:
                ctypes.WinDLL(p)
                loaded.append(name)
            except OSError:
                pass
    return loaded
