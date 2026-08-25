# ComfyUI-NVIDIA-RTX-Media-Toolkit

NVIDIA RTX 官方 AI 媒体处理套件 for ComfyUI。
**视频超分（VSR）× 照片AI超分（DLISR）× 智能插帧（RIFE）** 三合一。

- **超分**：调用 NVIDIA Video Effects SDK 的 RTX Video Super Resolution 官方模型
  （2x / 3x / 4x × conservative / aggressive 共 6 种），按 GPU 架构自动下载对应引擎
- **插帧**：RIFE v4.9（ONNX + onnxruntime CUDA），2x / 4x / 8x 倍率
- **AI 照片超分（DLISR）**：NVIDIA App 同款 Deep Learning Image Super-Resolution，
  2x / 4x / 8x 纯细节保持放大（零画风改变），直接走驱动 NGX 管线，无需下载大模型
- **兼容 RTX 20 系 ~ 50 系**（sm_75 / 86 / 89 / 120），模型引擎按架构自动获取
- **模型自动下载**：检测到本机缺模型时，自动从 NVIDIA 官方 CDN 拉取（约 750 MB，一次性），
  引擎文件装入节点包 `bin/` 目录

## 节点

| 节点 | 功能 |
|---|---|
| **RTX Model Manager** | 检测显卡 / 模型状态；一键下载 SDK 引擎、RIFE 模型 |
| **RTX VSR Video Super Resolution** | 图片超分：档位 × 预设、超分次数、目标长边 |
| **RTX VSR Video Super Resolution (Tiled)** | 分块超分，任意大图不降源分辨率 |
| **RTX DLISR AI Photo Upscale** | NVIDIA App 同款 AI 照片放大 2x/4x/8x（NGX 驱动管线） |
| **RIFE Frame Interpolate** | 帧序列插帧，2x / 4x / 8x |
| **RTX Video Pipeline (SR + Interp)** | 视频文件一站式：超分 → 插帧 → 输出 mp4 |

## 档位与预设

- **画质档位**：`DLAA（原生 1x）` / `质量 (2x)` / `均衡 (2x)` / `性能 (3x)` / `极致性能 (4x)`
- **风格预设 A–M**：映射 NVIDIA VSR 模型的保守/激进模式 + 强度
- **帧率倍增器**：1x / 2x / 4x / 8x
- **超分次数 passes / 目标长边 target_long_side**：精确控制输出尺寸

## 安装

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/ztztfdsf/ComfyUI-NVIDIA-RTX-Media-Toolkit.git
cd ComfyUI-NVIDIA-RTX-Media-Toolkit
python -m pip install -r requirements.txt   # 使用 ComfyUI 的 python
```

重启 ComfyUI。首次使用：
1. 工作流里添加 **RTX Model Manager**，`action` 选 `download_all` 运行一次；
2. 或直接在节点上开启 `auto_download`，运行时会自动下载模型。

> 仓库不包含大型模型文件（`bin/`、`rife/` 由脚本自动下载，见 `.gitignore`）。


## 兼容性 / 限制

- NVIDIA RTX 20/30/40/50 系，Windows
- onnxruntime CUDA 运行需要 CUDA 12 运行时（自动检测并预加载；缺失时回退 CPU）
- 7-Zip 用于解压 SDK 安装包（无则报错提示安装）
- **DLISR AI 照片超分**已集成（RTX DLISR AI Photo Upscale 节点）：
  - 优先使用本机环境：驱动自带 NGX 核心（`_nvngx.dll`）+ NVIDIA App / NGX OTA 已缓存的 snippet
  - 都没有时自动安装节点包内置的 `models/dlisr/160_0000000.bin`（4 MB，NVIDIA 签名 snippet）
  - 安装位置是 NVIDIA 自己的开放 ACL 缓存目录 `C:\ProgramData\NVIDIA\NGX\models\dlisr\`，
    仅新增文件、不改任何驱动组件；config 追加 `[dlisr]` 段前会自动备份
  - 需要 GeForce 驱动 470+ 与 RTX GPU；首次运行自动初始化，日志写入 `nvcore/ngx/logs/`

## 目录结构

```
ComfyUI-NVIDIA-RTX-Media-Toolkit/
├─ nodes.py          # 节点定义（画质档位/预设/帧率倍增器）
├─ nvcore/           # SR(ctypes) / RIFE(onnx) / 下载器 / NGX DLISR
│  └─ ngx/           # NGX 发现 / 授权补丁 / DLISR ctypes 封装
├─ bin/<sm_xx>/      # 各架构 SDK 运行时 + SR 引擎（自动下载，不入库）
├─ rife/rife49.onnx  # 插帧模型（自动下载，不入库）
├─ models/dlisr/     # DLISR 签名 snippet（内置兜底，4 MB）
└─ _downloads/       # SDK 安装包缓存
```
