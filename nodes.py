# -*- coding: utf-8 -*-
"""ComfyUI nodes for NVIDIA RTX VSR super-resolution + RIFE frame interpolation."""

import os

import torch

from .nvcore import common, download, interp, sr
from .nvcore import ngx as ngx_dlisr

RIFE_URL = ("https://huggingface.co/yuvraj108c/rife-onnx/resolve/main/"
            "rife49_ensemble_True_scale_1_sim.onnx")


def _ensure_sr(sm, auto_download):
    if download.models_present(sm):
        return
    if auto_download:
        download.download_sdk(progress=print)
        if not download.models_present(sm):
            raise RuntimeError("SDK download finished but models still missing.")
    else:
        raise RuntimeError(
            f"NVIDIA VSR SDK engines for {sm} are not installed yet.\n"
            "Enable 'auto_download' on this node (or run the 'RTX Model Manager' "
            "node with action=download_sdk) to fetch them automatically "
            "(~750 MB, one time).")


def _ensure_rife(auto_download):
    if os.path.isfile(common.RIFE_MODEL):
        return
    if auto_download:
        import urllib.request
        os.makedirs(common.RIFE_DIR, exist_ok=True)
        print(f"[RTX-Media-Toolkit] Downloading RIFE interpolation model ...")
        urllib.request.urlretrieve(RIFE_URL, common.RIFE_MODEL)
        if not os.path.isfile(common.RIFE_MODEL) or os.path.getsize(common.RIFE_MODEL) < 1_000_000:
            raise RuntimeError("RIFE model download failed.")
    else:
        raise RuntimeError(
            "RIFE interpolation model is not installed. Enable 'auto_download' "
            "(or run 'RTX Model Manager' with action=download_rife) to fetch it.")


# ---------------------------------------------------------------------------
# DLSS-style presets & quality tiers (mapped to the NVIDIA VSR engines we have)
# ---------------------------------------------------------------------------
# 超分辨率档位 (DLSS-style quality tiers) -> target scale
QUALITY_TIERS = [
    "DLAA（原生 1x）",
    "质量 (2x)",
    "均衡 (2x)",
    "性能 (3x)",
    "极致性能 (4x)",
]

# DLSS4-style presets A..M -> (mode: conservative=0/aggressive=1, strength)
# Higher letters = more aggressive/enhanced look (like DLSS preset progression).
PRESETS = [
    ("A", 0, 0.20), ("B", 0, 0.40), ("C", 1, 0.40), ("D", 1, 0.60),
    ("E", 0, 0.40), ("F", 1, 0.50), ("G", 1, 0.70), ("H", 0, 0.40),
    ("I", 0, 0.60), ("J", 1, 0.50), ("K", 1, 0.70), ("L", 1, 0.85),
    ("M", 1, 1.00),
]
_MODE_CN = {0: "保守", 1: "激进"}
PRESET_NAMES = [f"预设 {p[0]}（{_MODE_CN[p[1]]}，强度 {p[2]:.2f}）" for p in PRESETS]
_PRESET_LOOKUP = {p[0]: p for p in PRESETS}

# tier -> target scale
_TIER_SCALE = {
    "DLAA（原生 1x）": 1,
    "质量 (2x)": 2,
    "均衡 (2x)": 2,
    "性能 (3x)": 3,
    "极致性能 (4x)": 4,
}

_MODEL_BY_SCALE_MODE = {(m["scale"], m["mode"]): m["name"] for m in sr.MODEL_DEFS}


def _tier_preset_to_model(tier, preset):
    """Map (quality tier, preset letter) to an NVIDIA VSR model name + strength.
    Returns (model_name, strength, target_scale)."""
    scale = _TIER_SCALE[tier]
    letter = preset.split()[1]  # '预设 X ...'
    _m, mode, strength = _PRESET_LOOKUP[letter]
    if scale == 1:
        return None, 0.0, 1
    model = _MODEL_BY_SCALE_MODE.get((scale, mode))
    if model is None:
        model = _MODEL_BY_SCALE_MODE[(scale, 0)]
    return model, strength, scale


class RTXMT_ModelManager:
    """Check / install NVIDIA SDK engines and RIFE model."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "action": (["检查状态", "下载SDK引擎", "下载RIFE模型", "全部下载"],),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("状态",)
    FUNCTION = "run"
    CATEGORY = "图像/超分放大"

    def run(self, action):
        lines = []
        try:
            info = common.arch_info()
            lines.append(f"显卡：{torch.cuda.get_device_name(0)}（{info['label']}，{info['sm']}）")
            lines.append(f"VSR 引擎已安装：{'是' if download.models_present(info['sm']) else '否'}")
            lines.append(f"RIFE 模型已安装：{'是' if os.path.isfile(common.RIFE_MODEL) else '否'}")
            if action in ("下载SDK引擎", "全部下载"):
                r = download.download_sdk(progress=print)
                lines.append(r["message"])
            if action in ("下载RIFE模型", "全部下载"):
                _ensure_rife(auto_download=True)
                lines.append("RIFE 模型已安装。")
        except Exception as e:
            lines.append(f"错误：{e}")
        return ("\n".join(lines),)


# ---------------------------------------------------------------------------
class RTXMT_VSR_Upscale:
    """Image super-resolution with NVIDIA RTX VSR.
    DLSS-style: quality tier (DLAA..Ultra Performance) x preset (A..M),
    plus manual model / passes / target size for full control."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "quality_tier": (QUALITY_TIERS, {"default": QUALITY_TIERS[4]}),
                "preset": (PRESET_NAMES, {"default": PRESET_NAMES[10]}),
                "passes": ("INT", {"default": 1, "min": 1, "max": 6, "step": 1}),
                "target_long_side": ("INT", {"default": 0, "min": 0, "max": 16384, "step": 8}),
                "manual_model": ("BOOLEAN", {"default": False}),
                "model": (sr.MODEL_NAMES, {"default": "RTX VSR 4x 激进"}),
                "strength": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0, "step": 0.05}),
                "keep_input_limits": ("BOOLEAN", {"default": True}),
                "auto_download": ("BOOLEAN", {"default": True}),
            },
        }

    RETURN_TYPES = ("IMAGE", "FLOAT", "INT", "INT")
    RETURN_NAMES = ("图像", "放大倍数", "宽", "高")
    FUNCTION = "execute"
    CATEGORY = "图像/超分放大"

    def execute(self, image, quality_tier, preset, passes, target_long_side,
                manual_model, model, strength, keep_input_limits, auto_download):
        info = common.arch_info()
        sm = info["sm"]
        if manual_model:
            sel_model, sel_strength = model, strength
        else:
            sel_model, sel_strength, scale = _tier_preset_to_model(quality_tier, preset)
            if sel_model is None:
                return (image, 1.0, image.shape[2], image.shape[1])
        _ensure_sr(sm, auto_download)

        md = sr._MODEL_BY_NAME[sel_model]
        max_in = md["max_in"] if keep_input_limits else 10 ** 9
        frames = []
        for i in range(image.shape[0]):
            img = image[i]
            for _p in range(passes):
                h, w = img.shape[0], img.shape[1]
                if max(h, w) > max_in:
                    f = float(max_in) / max(h, w)
                    img = torch.nn.functional.interpolate(
                        img.permute(2, 0, 1).unsqueeze(0),
                        size=(max(90, int(h * f) // 8 * 8), max(90, int(w * f) // 8 * 8)),
                        mode="bicubic", align_corners=False, antialias=True,
                    ).squeeze(0).permute(1, 2, 0).clamp(0, 1)
                img = sr.upsample(img, sel_model, sel_strength, sm=sm)
            if target_long_side > 0:
                h, w = img.shape[0], img.shape[1]
                m = max(h, w)
                if m != target_long_side:
                    f = float(target_long_side) / m
                    img = torch.nn.functional.interpolate(
                        img.permute(2, 0, 1).unsqueeze(0),
                        size=(max(8, int(h * f)), max(8, int(w * f))),
                        mode="bicubic", align_corners=False, antialias=True,
                    ).squeeze(0).permute(1, 2, 0).clamp(0, 1)
            frames.append(img.cpu())

        out = torch.stack(frames)
        h0, w0 = image.shape[1], image.shape[2]
        return (out, out.shape[2] / w0, out.shape[2], out.shape[1])


# ---------------------------------------------------------------------------
class RTXMT_VSR_Upscale_Tiled(RTXMT_VSR_Upscale):
    """Tiled RTX VSR for arbitrarily large images without downscaling."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "model": (sr.MODEL_NAMES, {"default": "RTX VSR 2x 激进"}),
                "strength": ("FLOAT", {"default": 0.5, "min": 0.0, "max": 1.0, "step": 0.05}),
                "tile_size": ("INT", {"default": 512, "min": 128, "max": 1920, "step": 8}),
                "overlap": ("INT", {"default": 16, "min": 0, "max": 64, "step": 8}),
                "auto_download": ("BOOLEAN", {"default": True}),
            },
        }

    RETURN_TYPES = ("IMAGE", "FLOAT")
    RETURN_NAMES = ("图像", "放大倍数")
    FUNCTION = "execute_tiled"
    CATEGORY = "图像/超分放大"

    def execute_tiled(self, image, model, strength, tile_size, overlap, auto_download):
        info = common.arch_info()
        sm = info["sm"]
        _ensure_sr(sm, auto_download)
        md = sr._MODEL_BY_NAME[model]
        frames = []
        for i in range(image.shape[0]):
            img = image[i].to(device="cuda")
            h, w = img.shape[0], img.shape[1]
            step = tile_size - overlap
            out = torch.zeros((h * md["scale"], w * md["scale"], 3), dtype=torch.float32, device="cuda")
            ys = list(range(0, max(h - overlap, 1), step))
            xs = list(range(0, max(w - overlap, 1), step))
            for y in ys:
                for x in xs:
                    y1 = min(y, h - tile_size) if h >= tile_size else 0
                    x1 = min(x, w - tile_size) if w >= tile_size else 0
                    y2, x2 = min(y1 + tile_size, h), min(x1 + tile_size, w)
                    tile = img[y1:y2, x1:x2]
                    up = sr.upsample(tile, model, strength, sm=sm)
                    oy2, ox2 = min((y1 + tile.shape[0]) * md["scale"], out.shape[0]), \
                               min((x1 + tile.shape[1]) * md["scale"], out.shape[1])
                    out[y1 * md["scale"]:oy2, x1 * md["scale"]:ox2] = \
                        up[: oy2 - y1 * md["scale"], : ox2 - x1 * md["scale"]]
            frames.append(out.clamp(0, 1).cpu())
        return (torch.stack(frames), md["scale"])


# ---------------------------------------------------------------------------
class RTXMT_FrameInterpolate:
    """Video frame interpolation. Input: batch of frames. rate: 2/4/8."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "frames": ("IMAGE",),
                "rate": ([2, 4, 8], {"default": 2}),
                "auto_download": ("BOOLEAN", {"default": True}),
            },
        }

    RETURN_TYPES = ("IMAGE", "INT")
    RETURN_NAMES = ("帧序列", "帧数")
    FUNCTION = "execute"
    CATEGORY = "视频"

    def execute(self, frames, rate, auto_download):
        _ensure_rife(auto_download)
        fl = [frames[i] for i in range(frames.shape[0])]
        out = interp.interpolate(fl, rate)
        return (torch.stack(out), len(out))


# ---------------------------------------------------------------------------
class RTXMT_DLISR_Upscale:
    """NVIDIA DLISR (Deep Learning Image Super-Resolution) - the same AI photo
    upscaler NVIDIA App uses. Pure detail-preserving 2x/4x/8x upscale, no
    hallucination. Runs on the driver's NGX pipeline (no extra models to download
    when NVIDIA App / NGX OTA cache is present; a bundled snippet is used as a
    fallback). Requires an RTX GPU and recent GeForce drivers."""

    SCALES = {"2x": 2, "4x": 4, "8x": 8}

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "scale": (["2x", "4x", "8x"], {"default": "2x"}),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("图像",)
    FUNCTION = "execute"
    CATEGORY = "图像/超分放大"

    def execute(self, image, scale):
        factor = self.SCALES[scale]
        session = ngx_dlisr.get_session()
        frames = [image[i] for i in range(image.shape[0])]
        out = []
        for f in frames:
            arr = (f.cpu().numpy() * 255.0).round().clip(0, 255).astype("uint8")
            up = session.upscale(arr, factor)
            t = torch.from_numpy(up.astype("float32") / 255.0)
            out.append(t)
        return (torch.stack(out),)


# ---------------------------------------------------------------------------
class RTXMT_VideoPipeline:
    """Video file -> (RTX VSR super resolution) -> (RIFE interpolation) -> video file."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "video_path": ("STRING", {"default": ""}),
                "output_path": ("STRING", {"default": ""}),
                "quality_tier": (QUALITY_TIERS, {"default": QUALITY_TIERS[1]}),
                "preset": (PRESET_NAMES, {"default": PRESET_NAMES[2]}),
                "fps_multiplier": ([1, 2, 4, 8], {"default": 2}),
                "fps_override": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 240.0}),
                "auto_download": ("BOOLEAN", {"default": True}),
            },
            "optional": {
                "images": ("IMAGE",),
            },
        }

    RETURN_TYPES = ("STRING", "INT", "INT")
    RETURN_NAMES = ("输出路径", "输出帧数", "输出帧率")
    FUNCTION = "execute"
    CATEGORY = "视频"

    def execute(self, video_path, output_path, quality_tier, preset, fps_multiplier,
                fps_override, auto_download, images=None):
        import cv2

        info = common.arch_info()
        sm = info["sm"]
        sel_model, sel_strength, _scale = _tier_preset_to_model(quality_tier, preset)
        if sel_model is not None:
            _ensure_sr(sm, auto_download)
        if fps_multiplier > 1:
            _ensure_rife(auto_download)

        if images is not None:
            # 工作流图像帧作为源（忽略 video_path）
            src_frames = [images[i].cpu() for i in range(images.shape[0])]
            total = len(src_frames)
            fps = fps_override if fps_override > 0 else 30.0
            if not output_path:
                try:
                    from folder_paths import get_output_directory
                    output_path = os.path.join(get_output_directory(), "rtxmt_pipeline.mp4")
                except Exception:
                    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rtxmt_pipeline.mp4")
        else:
            if not video_path or not os.path.isfile(video_path):
                raise RuntimeError(f"未找到视频文件：{video_path}（或直接连入 images 图像）")
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                raise RuntimeError("无法打开视频文件")
            fps = fps_override if fps_override > 0 else cap.get(cv2.CAP_PROP_FPS) or 30.0
            total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            if not output_path:
                root, ext = os.path.splitext(video_path)
                output_path = f"{root}_nvvfx{ext}"

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = None
        frames_written = 0
        idx = 0
        window = []
        win_size = 32

        def flush_window(keep_last=True):
            nonlocal window, frames_written, writer
            if not window:
                return
            if fps_multiplier > 1 and len(window) >= 2:
                window = interp.interpolate(window, fps_multiplier)
            drop = 1 if (keep_last and len(window) > 1) else 0
            for f in window[: len(window) - drop]:
                rgb = (f.clamp(0, 1).numpy() * 255).astype("uint8")
                bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
                if writer is None:
                    hh, ww = bgr.shape[:2]
                    writer = cv2.VideoWriter(output_path, fourcc, fps * fps_multiplier, (ww, hh))
                writer.write(bgr)
                frames_written += 1
            if drop:
                window = [window[-1]]
            else:
                window = []

        for img in src_frames:
            if sel_model is not None:
                img = sr.upsample(img, sel_model, sel_strength, sm=sm).cpu()
            window.append(img)
            if len(window) >= win_size:
                flush_window(keep_last=True)
            idx += 1
            if idx % 50 == 0:
                print(f"[RTX-Media-Toolkit] frame {idx}/{total}")
        flush_window(keep_last=False)
        if writer is not None:
            writer.release()
        if frames_written == 0:
            raise RuntimeError("No frames written")
        return (output_path, frames_written, int(round(fps * fps_multiplier)))
