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
    "RTXMT_ModelManager": "RTX Model Manager (driver/models)",
    "RTXMT_VSR_Upscale": "RTX VSR Video Super Resolution",
    "RTXMT_VSR_Upscale_Tiled": "RTX VSR Video Super Resolution (Tiled)",
    "RTXMT_DLISR_Upscale": "RTX DLISR AI Photo Upscale (2x/4x/8x)",
    "RTXMT_FrameInterpolate": "RIFE Frame Interpolate (2x/4x/8x)",
    "RTXMT_VideoPipeline": "RTX Video Pipeline (SR + Interp)",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
