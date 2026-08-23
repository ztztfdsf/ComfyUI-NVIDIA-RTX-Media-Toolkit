# -*- coding: utf-8 -*-
"""NVIDIA NGX DLISR (image super-resolution) support."""

from . import discovery
from .dlisr import get_session, upscale

__all__ = ["discovery", "get_session", "upscale"]
