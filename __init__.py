from .nodes import (
    RTXMT_ImageUpscale,
    RTXMT_VideoEnhance,
    RTXMT_ModelManager,
)

NODE_CLASS_MAPPINGS = {
    "RTXMT_ImageUpscale": RTXMT_ImageUpscale,
    "RTXMT_VideoEnhance": RTXMT_VideoEnhance,
    "RTXMT_ModelManager": RTXMT_ModelManager,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "RTXMT_ImageUpscale": "RTX 图像AI超分（DLISR/VSR）",
    "RTXMT_VideoEnhance": "RTX 视频增强（超分+插帧）",
    "RTXMT_ModelManager": "RTX 模型管理器（驱动/模型）",
}

WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
