from .nodes import (
    NVVFX_ModelManager,
    NVVFX_SuperRes,
    NVVFX_SuperRes_Tiled,
    NVVFX_FrameInterpolate,
    NVVFX_VideoPipeline,
)

NODE_CLASS_MAPPINGS = {
    "NVVFX_ModelManager": NVVFX_ModelManager,
    "NVVFX_SuperRes": NVVFX_SuperRes,
    "NVVFX_SuperRes_Tiled": NVVFX_SuperRes_Tiled,
    "NVVFX_FrameInterpolate": NVVFX_FrameInterpolate,
    "NVVFX_VideoPipeline": NVVFX_VideoPipeline,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NVVFX_ModelManager": "NVVFX Model Manager (driver/models)",
    "NVVFX_SuperRes": "NVVFX RTX VSR Super Resolution",
    "NVVFX_SuperRes_Tiled": "NVVFX RTX VSR Super Resolution (Tiled)",
    "NVVFX_FrameInterpolate": "NVVFX Frame Interpolate (RIFE)",
    "NVVFX_VideoPipeline": "NVVFX Video Pipeline (SR + Interp)",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
