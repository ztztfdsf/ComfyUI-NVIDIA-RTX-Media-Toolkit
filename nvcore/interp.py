# -*- coding: utf-8 -*-
"""RIFE v4.9 frame interpolation (ONNX, CUDA) - used for video frame doubling.

Note: NVIDIA does not ship a public *video* frame-interpolation model (DLSS 3
Frame Generation is game-only). We use the open-source RIFE model, which runs
on NVIDIA GPUs via onnxruntime CUDA, to provide the interpolation feature.
"""

import os
import threading

import numpy as np
import torch

from . import common

_lock = threading.Lock()
_session = None
_session_path = None


def _load_session():
    global _session, _session_path
    if _session is not None and _session_path == common.RIFE_MODEL:
        return _session
    with _lock:
        if _session is not None and _session_path == common.RIFE_MODEL:
            return _session
        if not os.path.isfile(common.RIFE_MODEL):
            raise FileNotFoundError(
                f"RIFE interpolation model missing: {common.RIFE_MODEL}\n"
                "Enable 'auto_download' (or run the RTX Model Manager node with "
                "action=download_rife) to fetch it automatically.")
        import onnxruntime as ort
        common.preload_ort_cuda_deps()
        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        opts.log_severity_level = 3
        try:
            providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
            sess = ort.InferenceSession(common.RIFE_MODEL, sess_options=opts, providers=providers)
        except Exception:
            sess = ort.InferenceSession(common.RIFE_MODEL, sess_options=opts,
                                        providers=["CPUExecutionProvider"])
        _session = sess
        _session_path = common.RIFE_MODEL
        return sess


def _interp_pair(a, b, t=0.5):
    """a, b: np float32 [3,H,W] 0..1. Returns [3,H,W]."""
    sess = _load_session()
    feed = {
        "img0": a[None],
        "img1": b[None],
        "timestep": np.array([t], dtype=np.float32),
    }
    return sess.run(None, feed)[0][0]


def interpolate(frames, rate):
    """frames: list of torch [H,W,3] RGB float32 (0..1). rate: 2/4/8.
    Returns list of interpolated frames (includes originals), each [H,W,3]."""
    if rate not in (2, 4, 8):
        raise ValueError(f"Interpolation rate must be 2, 4 or 8, got {rate}")
    depth = int(round(np.log2(rate)))

    frames = [f.to(device="cpu") for f in frames]
    n = len(frames)
    if n < 2:
        return frames

    h, w = frames[0].shape[0], frames[0].shape[1]
    ph, pw = (32 - h % 32) % 32, (32 - w % 32) % 32
    pad = (ph > 0) or (pw > 0)

    def prep(f):
        # [H,W,3] -> [3,H,W], padded to multiple of 32
        x = f.permute(2, 0, 1)
        if pad:
            x = torch.nn.functional.pad(x, (0, pw, 0, ph))
        return x.contiguous().numpy().astype(np.float32)

    def unpad(x):
        t = torch.from_numpy(x)  # [3,H,W]
        if pad:
            t = t[:, :h, :w]
        return t.permute(1, 2, 0).clamp(0, 1)

    def gen(a, b, d):
        if d == 0:
            return []
        m = _interp_pair(a, b, 0.5)
        return gen(a, m, d - 1) + [m] + gen(m, b, d - 1)

    out = [frames[0]]
    for i in range(n - 1):
        a, b = prep(frames[i]), prep(frames[i + 1])
        mids = gen(a, b, depth)
        for m in mids:
            out.append(unpad(m).clamp(0, 1))
        out.append(frames[i + 1])
    return out
