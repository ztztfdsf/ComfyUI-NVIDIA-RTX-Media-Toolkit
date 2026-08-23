# -*- coding: utf-8 -*-
"""ctypes bindings for NVIDIA NGX DLISR (Deep Learning Image Super-Resolution).

This drives the CUDA NGX pipeline directly:

    NVSDK_NGX_CUDA_Init -> GetParameters -> (set params) -> GetScratchBufferSize
    -> CreateFeature(featureId=3) -> EvaluateFeature -> ReleaseFeature

Protocol notes (reverse engineered, driver 610.x / NGX core 1.4):
  * Width/Height/Scale are Set(int); Scale must be 2, 4 or 8.
  * Color/Output device pointers must be stored as pointer/ULL type entries
    (the internal reader only accepts type 6/7 for the main pointer).
  * *.SizeInBytes must be ULL-typed for CreateFeature, but EvaluateFeature's
    reader fetches them through GetVoidPointer which only converts numeric
    types -- so they are re-set with SetUI after CreateFeature.
  * Newer drivers run unregistered apps in a "shadow mode" where calls are
    queued but never executed.  Writing our app id into the core singleton
    (first u64 of the object pointed to by the driver's global NGX context
    pointer) switches it into real execution mode.
"""

import ctypes
import os
import threading

import torch

from . import discovery

_NVSDK_VERSION = 0x15  # NVSDK_NGX_VERSION_API_MACRO (API 1.5.0)

_lock = threading.Lock()
_state = None  # singleton session


class _Session:
    def __init__(self, dll_path):
        self.dll_path = dll_path
        self.base = None
        self.ngx = ctypes.WinDLL(dll_path)
        k32 = ctypes.WinDLL("kernel32")
        k32.GetModuleHandleW.restype = ctypes.c_void_p
        k32.GetModuleHandleW.argtypes = [ctypes.c_wchar_p]
        self.base = k32.GetModuleHandleW(dll_path)

        for fn, at in [
            ("NVSDK_NGX_CUDA_Init", [ctypes.c_ulonglong, ctypes.c_wchar_p, ctypes.c_uint]),
            ("NVSDK_NGX_CUDA_GetParameters", [ctypes.POINTER(ctypes.c_void_p)]),
            ("NVSDK_NGX_CUDA_GetScratchBufferSize", [ctypes.c_int, ctypes.c_void_p,
                                                     ctypes.POINTER(ctypes.c_size_t)]),
            ("NVSDK_NGX_CUDA_CreateFeature", [ctypes.c_int, ctypes.c_void_p,
                                              ctypes.POINTER(ctypes.c_void_p)]),
            ("NVSDK_NGX_CUDA_EvaluateFeature", [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p]),
            ("NVSDK_NGX_CUDA_ReleaseFeature", [ctypes.c_void_p]),
        ]:
            f = getattr(self.ngx, fn)
            f.restype = ctypes.c_int
            f.argtypes = at

        # CUDA context must exist before Init
        if not torch.cuda.is_available():
            raise RuntimeError("DLISR requires an NVIDIA RTX GPU (CUDA).")
        torch.zeros(1, device="cuda")
        torch.cuda.synchronize()

        log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
        try:
            os.makedirs(log_dir, exist_ok=True)
            os.environ["__NGX_ENABLE_OVERRIDE_LOG_PATH"] = "1"
            os.environ["__NGX_LOG_PATH_OVERRIDE"] = log_dir
            os.environ["__NGX_LOG_LEVEL"] = "3"
        except OSError:
            pass

        r = self.ngx.NVSDK_NGX_CUDA_Init(discovery.DLISR_APPID, log_dir, _NVSDK_VERSION)
        if r != 1:
            raise RuntimeError(f"NVSDK_NGX_CUDA_Init failed: {r:#x}")

        self.params = ctypes.c_void_p()
        self.ngx.NVSDK_NGX_CUDA_GetParameters(ctypes.byref(self.params))
        if not self.params.value:
            raise RuntimeError("NVSDK_NGX_CUDA_GetParameters returned NULL.")
        self.vt = ctypes.cast(self.params, ctypes.POINTER(ctypes.c_void_p))[0]
        self._patch_appid()

    # -- authorization patch ------------------------------------------------
    def _patch_appid(self):
        """Write our app id into the NGX core singleton (first u64).

        The global pointer offset (0xDB800 on 610.88) may shift between driver
        releases; failure is non-fatal (older drivers do not need the patch).
        """
        try:
            for off in (0xDB800, 0xDB7F8, 0xDB810):
                gp = ctypes.cast(self.base + off, ctypes.POINTER(ctypes.c_void_p))[0]
                if not gp:
                    continue
                # sanity: singleton should be a sizable heap object
                cur = ctypes.cast(ctypes.c_void_p(gp), ctypes.POINTER(ctypes.c_ulonglong))[0]
                if cur not in (0, discovery.DLISR_APPID):
                    continue
                ctypes.cast(ctypes.c_void_p(gp),
                            ctypes.POINTER(ctypes.c_ulonglong))[0] = discovery.DLISR_APPID
                self.patched_offset = off
                return True
        except Exception as e:  # noqa: BLE001
            print(f"[NVVFX-Pro] DLISR app-id patch skipped: {e}")
        print("[NVVFX-Pro] Warning: DLISR app-id patch did not apply; "
              "if upscaling silently no-ops, your driver build may need an update.")
        return False

    # -- parameter setters --------------------------------------------------
    def _fn(self, idx, rt, *at):
        return ctypes.CFUNCTYPE(rt, *at)(
            ctypes.cast(self.vt + idx * 8, ctypes.POINTER(ctypes.c_void_p))[0])

    # -- main API -----------------------------------------------------------
    def upscale(self, img_u8, scale=2):
        """img_u8: HxWx3 RGB uint8 (BGR handled internally) -> H*scale x W*scale RGB."""
        import numpy as np
        H, W = img_u8.shape[:2]
        if scale not in (2, 4, 8):
            raise ValueError("DLISR scale must be 2, 4 or 8.")
        src = torch.from_numpy(np.ascontiguousarray(img_u8[..., ::-1])).cuda()
        dst = torch.zeros((H * scale, W * scale, 3), dtype=torch.uint8, device="cuda")
        P = self.params.value

        s_ull = self._fn(0, None, ctypes.c_void_p, ctypes.c_char_p, ctypes.c_ulonglong)
        s_ui = self._fn(3, None, ctypes.c_void_p, ctypes.c_char_p, ctypes.c_uint)
        s_i = self._fn(4, None, ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int)

        s_i(P, b"Width", W); s_i(P, b"Height", H); s_i(P, b"Scale", scale)
        s_ull(P, b"Color.SizeInBytes", W * H * 3); s_i(P, b"Color.Format", 1)
        s_ull(P, b"Color", src.data_ptr())
        s_ull(P, b"Output.SizeInBytes", W * scale * H * scale * 3); s_i(P, b"Output.Format", 1)
        s_ull(P, b"Output", dst.data_ptr())

        sz = ctypes.c_size_t(0)
        self.ngx.NVSDK_NGX_CUDA_GetScratchBufferSize(3, self.params, ctypes.byref(sz))

        handle = ctypes.c_void_p()
        rc = self.ngx.NVSDK_NGX_CUDA_CreateFeature(3, self.params, ctypes.byref(handle))
        if rc != 1:
            raise RuntimeError(f"NGX CreateFeature(DLISR) failed: {rc:#x}")

        # SizeInBytes must become numeric-typed before Evaluate (see module doc)
        s_ui(P, b"Color.SizeInBytes", W * H * 3)
        s_ui(P, b"Output.SizeInBytes", W * scale * H * scale * 3)

        r = self.ngx.NVSDK_NGX_CUDA_EvaluateFeature(handle, self.params, None)
        torch.cuda.synchronize()
        self.ngx.NVSDK_NGX_CUDA_ReleaseFeature(handle)
        if r != 1:
            raise RuntimeError(f"NGX EvaluateFeature(DLISR) failed: {r:#x}")
        out = dst.cpu().numpy().copy()[..., ::-1]  # back to RGB
        return np.ascontiguousarray(out)


def get_session():
    """Create (once) and return the DLISR session."""
    global _state
    with _lock:
        if _state is None:
            dll, _ = discovery.setup_all()
            _state = _Session(dll)
            print(f"[NVVFX-Pro] DLISR ready (NGX core: {dll})")
        return _state


def upscale(img_u8, scale=2):
    """Module-level convenience API. img_u8: HxWx3 RGB uint8 numpy array."""
    return get_session().upscale(img_u8, scale)
