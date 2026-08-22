# -*- coding: utf-8 -*-
"""NVIDIA RTX Video Super Resolution engine via ctypes to NVVideoEffects.dll.

Effect selector: "SuperRes". Input/Output images are normalized BGR F32 planar
GPU images (NvCVImage). The SDK picks the right `.engine.trtpkg` model from
ModelDir based on the detected GPU architecture.
"""

import ctypes as C
import os
import threading

import torch

from . import common

NVCV_BGR = 5
NVCV_F32 = 7
GPU_CUDA = 1

P_SRC = b"SrcImage0"
P_DST = b"DstImage0"
P_MODEL_DIR = b"ModelDir"
P_STRENGTH = b"Strength"
P_MODE = b"Mode"
P_STREAM = b"CudaStream"

# NVIDIA VSR models exposed to the user (engine names from the SDK)
MODEL_DEFS = [
    {"name": "RTX VSR 2x (conservative)", "scale": 2, "mode": 0, "max_in": 1920},
    {"name": "RTX VSR 2x (aggressive)",   "scale": 2, "mode": 1, "max_in": 1920},
    {"name": "RTX VSR 3x (conservative)", "scale": 3, "mode": 0, "max_in": 1280},
    {"name": "RTX VSR 3x (aggressive)",   "scale": 3, "mode": 1, "max_in": 1280},
    {"name": "RTX VSR 4x (conservative)", "scale": 4, "mode": 0, "max_in": 960},
    {"name": "RTX VSR 4x (aggressive)",   "scale": 4, "mode": 1, "max_in": 960},
]
MODEL_NAMES = [m["name"] for m in MODEL_DEFS]
_MODEL_BY_NAME = {m["name"]: m for m in MODEL_DEFS}


class NvCVImage(C.Structure):
    _fields_ = [
        ("width", C.c_uint), ("height", C.c_uint), ("pitch", C.c_uint),
        ("pixelFormat", C.c_int), ("componentType", C.c_int),
        ("pixelBytes", C.c_ubyte), ("componentBytes", C.c_ubyte), ("numComponents", C.c_ubyte),
        ("planar", C.c_ubyte), ("gpuMem", C.c_ubyte), ("colorspace", C.c_ubyte),
        ("reserved", C.c_ubyte * 2),
        ("pixels", C.c_void_p), ("deletePtr", C.c_void_p), ("deleteProc", C.c_void_p),
        ("bufferBytes", C.c_ulonglong),
    ]


def _make_img(w, h, pitch, pixel_bytes, comp_bytes, num_comp, planar):
    im = NvCVImage()
    im.width = w
    im.height = h
    im.pitch = pitch
    im.pixelFormat = NVCV_BGR
    im.componentType = NVCV_F32
    im.pixelBytes = pixel_bytes
    im.componentBytes = comp_bytes
    im.numComponents = num_comp
    im.planar = planar
    im.gpuMem = GPU_CUDA
    return im


_lock = threading.Lock()
_effects = {}


class _SRInstance:
    def __init__(self, sm, scale, mode, strength):
        self.bin_dir = os.path.join(common.BIN_ROOT, sm)
        self.models_dir = os.path.join(self.bin_dir, "models")
        os.add_dll_directory(self.bin_dir)
        if self.bin_dir not in os.environ.get("PATH", ""):
            os.environ["PATH"] = self.bin_dir + ";" + os.environ.get("PATH", "")
        self.dll = C.CDLL(os.path.join(self.bin_dir, "NVVideoEffects.dll"))
        self.eff = C.c_void_p()
        r = self.dll.NvVFX_CreateEffect(C.c_char_p(b"SuperRes"), C.byref(self.eff))
        if r != 0:
            raise RuntimeError(f"NvVFX_CreateEffect failed ({r}) - GPU not supported by this SDK build.")
        r = self.dll.NvVFX_SetString(self.eff, P_MODEL_DIR, self.models_dir.encode("mbcs", "replace"))
        if r != 0:
            raise RuntimeError(f"Set ModelDir failed ({r})")
        self.scale = scale
        self.mode = mode
        self.strength = strength
        self.src = None
        self.dst = None
        self.loaded = False

    def _ensure(self, w, h):
        if self.src is not None and self.src.shape[2] == w and self.src.shape[1] == h:
            return
        s = self.scale
        self.src = torch.zeros((3, h, w), dtype=torch.float32, device="cuda")
        self.dst = torch.zeros((3, h * s, w * s), dtype=torch.float32, device="cuda")
        imsrc = _make_img(w, h, w * 4, 4, 4, 3, 1)
        imsrc.pixels = self.src.data_ptr()
        imdst = _make_img(w * s, h * s, w * s * 4, 12, 4, 3, 1)
        imdst.pixels = self.dst.data_ptr()
        if self.dll.NvVFX_SetImage(self.eff, P_DST, C.byref(imdst)) != 0:
            raise RuntimeError("Set dst image failed")
        if self.dll.NvVFX_SetImage(self.eff, P_SRC, C.byref(imsrc)) != 0:
            raise RuntimeError("Set src image failed")
        self.dll.NvVFX_SetCudaStream(self.eff, P_STREAM,
                                     C.c_void_p(torch.cuda.current_stream().cuda_stream))
        self.dll.NvVFX_SetF32(self.eff, P_STRENGTH, C.c_float(self.strength))
        self.dll.NvVFX_SetU32(self.eff, P_MODE, self.mode)
        r = self.dll.NvVFX_Load(self.eff)
        if r != 0:
            raise RuntimeError(f"NvVFX_Load failed ({r})")
        self.loaded = True

    def run(self, bgr_planar):
        _, h, w = bgr_planar.shape
        self._ensure(w, h)
        self.src.copy_(bgr_planar)
        r = self.dll.NvVFX_Run(self.eff, 0)
        torch.cuda.synchronize()
        if r != 0:
            raise RuntimeError(f"NvVFX_Run failed ({r})")
        return self.dst.clone()


def _get_instance(sm, scale, mode, strength):
    key = (sm, scale, mode, round(strength, 2))
    with _lock:
        inst = _effects.get(key)
        if inst is None:
            inst = _SRInstance(sm, scale, mode, strength)
            _effects[key] = inst
        return inst


def upsample(image_rgb, model_name, strength=0.5, sm=None):
    """image_rgb: [H,W,3] RGB float32 0..1 (any device). Returns [sH,sW,3] RGB cuda."""
    md = _MODEL_BY_NAME[model_name]
    if sm is None:
        sm = common.arch_info()["sm"]
    img = image_rgb.to(device="cuda")
    h, w = img.shape[0], img.shape[1]
    ph, pw = (8 - h % 8) % 8, (8 - w % 8) % 8
    if ph or pw:
        img = torch.nn.functional.pad(img.permute(2, 0, 1), (0, pw, 0, ph)).permute(1, 2, 0)
    bgr = img.flip(-1).permute(2, 0, 1).contiguous()
    out = _get_instance(sm, md["scale"], md["mode"], strength).run(bgr)
    out_rgb = out.flip(0).permute(1, 2, 0).clamp(0, 1)
    if ph or pw:
        out_rgb = out_rgb[: h * md["scale"], : w * md["scale"]]
    return out_rgb
