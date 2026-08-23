from .nodes import (
    RTXMT_ModelManager,
    RTXMT_VSR_Upscale,
    RTXMT_VSR_Upscale_Tiled,
    RTXMT_DLISR_Upscale,
    RTXMT_FrameInterpolate,
    RTXMT_VideoPipeline,
)

NODE_CLASS_MAPPINGS = {
    "RTXMT_ModelManager": RTXMT_ModelManager,
    "RTXMT_VSR_Upscale": RTXMT_VSR_Upscale,
    "RTXMT_VSR_Upscale_Tiled": RTXMT_VSR_Upscale_Tiled,
    "RTXMT_DLISR_Upscale": RTXMT_DLISR_Upscale,
    "RTXMT_FrameInterpolate": RTXMT_FrameInterpolate,
    "RTXMT_VideoPipeline": RTXMT_VideoPipeline,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "RTXMT_ModelManager": "RTX 模型管理器（驱动/模型）",
    "RTXMT_VSR_Upscale": "RTX VSR 视频超分（2x/3x/4x）",
    "RTXMT_VSR_Upscale_Tiled": "RTX VSR 视频超分·分块（任意大图）",
    "RTXMT_DLISR_Upscale": "RTX DLISR 照片AI超分（2x/4x/8x）",
    "RTXMT_FrameInterpolate": "RIFE 视频插帧（2x/4x/8x）",
    "RTXMT_VideoPipeline": "RTX 视频管线（超分+插帧）",
}

WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
