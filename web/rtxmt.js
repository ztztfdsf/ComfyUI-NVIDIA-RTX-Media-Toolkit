/**
 * ComfyUI-NVIDIA-RTX-Media-Toolkit — 前端主题（NVIDIA 黑绿风）
 * - 黑底白字标题（可读性优先），NVIDIA 绿 #76B900 点缀
 * - 节点底部品牌条：NVIDIA 眼形标 + 中文能力徽章
 * - 全部 widget 标签中文化（仅显示层，API 参数名不变）
 */
import { app } from "../../scripts/app.js";

const THEME = {
    green: "#76B900",
    greenBright: "#8fd400",
    greenDark: "#4a7300",
    titleBg: "#101210",
    panel: "#12140f",
    badgeText: "#101400",
    footerText: "#0e1206",
};

const BADGES = {
    RTXMT_DLISR_Upscale: "照片超分 DLISR",
    RTXMT_VSR_Upscale: "视频超分 VSR",
    RTXMT_VSR_Upscale_Tiled: "视频超分 · 分块",
    RTXMT_FrameInterpolate: "智能插帧 RIFE",
    RTXMT_VideoPipeline: "超分 + 插帧 一条龙",
    RTXMT_ModelManager: "驱动与模型",
};

// widget 标签中英映射（只改显示，不动 API 参数名）
const LABEL_CN = {
    image: "图像",
    scale: "放大倍数",
    frames: "帧序列",
    rate: "插帧倍率",
    auto_download: "自动下载模型",
    quality_tier: "画质档位",
    preset: "风格预设",
    passes: "超分次数",
    target_long_side: "目标长边",
    manual_model: "手动指定模型",
    model: "模型",
    strength: "强度",
    keep_input_limits: "保持输入尺寸",
    video_path: "视频路径",
    output_path: "输出路径",
    fps_multiplier: "帧率倍增",
    fps_override: "帧率覆盖",
    action: "操作",
    tile_size: "分块尺寸",
    overlap: "重叠像素",
};

function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawBrandBar(ctx, node, badge) {
    const h = 26;
    const w = node.size[0];
    const y = node.size[1] - h;
    if (y < 34) return;

    ctx.save();
    const g = ctx.createLinearGradient(0, y, w, y + h);
    g.addColorStop(0, THEME.green);
    g.addColorStop(1, THEME.greenDark);
    ctx.fillStyle = g;
    roundRectPath(ctx, 1, y, w - 2, h - 1, 8);
    ctx.fill();

    // NVIDIA 眼形标
    ctx.fillStyle = THEME.black;
    roundRectPath(ctx, 8, y + 5.5, 15, 15, 3.5);
    ctx.fill();
    ctx.fillStyle = THEME.greenBright;
    ctx.beginPath();
    ctx.ellipse(15.5, y + 13, 5.4, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = THEME.black;
    ctx.beginPath();
    ctx.arc(15.5, y + 13, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = "bold 12px 'Segoe UI', 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = THEME.footerText;
    ctx.fillText("NVIDIA RTX", 29, y + h / 2 + 0.5);

    ctx.textAlign = "right";
    ctx.font = "bold 11px 'Segoe UI', 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = THEME.badgeText;
    ctx.fillText(badge, w - 10, y + h / 2 + 0.5);
    ctx.restore();
}

function drawCollapsedStrip(ctx, node, badge) {
    ctx.save();
    ctx.fillStyle = THEME.green;
    roundRectPath(ctx, 1, 1, node.size[0] - 2, node.size[1] - 2, 7);
    ctx.fill();
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = "bold 13px 'Segoe UI', 'Microsoft YaHei', sans-serif";
    ctx.fillStyle = THEME.footerText;
    ctx.fillText("NVIDIA RTX · " + badge, 10, node.size[1] / 2 + 0.5);
    ctx.restore();
}

// 连接点（输入/输出）标签中英映射
const SOCKET_CN = {
    image: "图像",
    scale_factor: "放大倍数",
    width: "宽",
    height: "高",
    frames: "帧序列",
    frame_count: "帧数",
    output_path: "输出路径",
    out_frames: "输出帧数",
    out_fps: "输出帧率",
    status: "状态",
    images: "图像帧",
};

function localizeSockets(node) {
    for (const s of node.inputs || []) {
        const cn = SOCKET_CN[s.name];
        if (cn && s.label !== cn) s.label = cn;
    }
    for (const s of node.outputs || []) {
        const cn = SOCKET_CN[s.name];
        if (cn && s.label !== cn) s.label = cn;
    }
}

function localizeWidgets(node) {
    if (!node.widgets) return;
    for (const w of node.widgets) {
        const cn = LABEL_CN[w.name];
        if (cn && w.name !== cn) {
            try { w.label = cn; } catch (e) { /* ignore */ }
        }
    }
}

app.registerExtension({
    name: "RTXMT.NVIDIA-Theme",

    beforeRegisterNodeDef(nodeType, nodeData) {
        if (!nodeData.name || !nodeData.name.startsWith("RTXMT_")) return;
        const badge = BADGES[nodeData.name] || "RTX";

        const baseOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = baseOnNodeCreated ? baseOnNodeCreated.apply(this, arguments) : undefined;
            this.color = THEME.titleBg;   // 标题条：黑底（主题白字，对比清晰）
            this.bgcolor = THEME.panel;   // 主体
            localizeWidgets(this);
            this._rtxBadge = badge;
            return r;
        };

        // 中文化标题（覆盖 litegraph 绘制的 title 文本）
        const baseDrawTitle = nodeType.prototype.onDrawTitle;
        nodeType.prototype.onDrawTitle = function (ctx) {
            if (baseDrawTitle) baseDrawTitle.apply(this, arguments);
            try {
                if (this.flags && this.flags.collapsed) return;
                ctx.save();
                ctx.textBaseline = "middle";
                ctx.textAlign = "left";
                ctx.font = "bold 13px 'Segoe UI', 'Microsoft YaHei', sans-serif";
                // 擦掉原英文标题行，写中文
                const th = LiteGraph.NODE_TITLE_HEIGHT || 30;
                ctx.fillStyle = THEME.titleBg;
                ctx.fillRect(20, -th, this.size[0] - 40, th);
                ctx.fillStyle = "#f2f6ea";
                ctx.fillText(this.title || "", 30, -th / 2);
                // 标题右侧小绿点
                ctx.fillStyle = THEME.green;
                ctx.beginPath();
                ctx.arc(this.size[0] - 14, -th / 2, 3.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } catch (e) { /* ignore */ }
        };

        const baseOnConn = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (side) {
            const r = baseOnConn ? baseOnConn.apply(this, arguments) : undefined;
            try { if (side === 1) localizeSockets(this); } catch (e) {}
            return r;
        };

        const baseDrawBg = nodeType.prototype.onDrawBackground;
        nodeType.prototype.onDrawBackground = function (ctx) {
            if (baseDrawBg) baseDrawBg.apply(this, arguments);
            try {
                localizeSockets(this);   // 幂等，输入点可能晚于 onNodeCreated 创建
                localizeWidgets(this);
                if (this.flags && this.flags.collapsed) {
                    drawCollapsedStrip(ctx, this, this._rtxBadge || badge);
                } else {
                    drawBrandBar(ctx, this, this._rtxBadge || badge);
                }
            } catch (e) { /* never break the graph */ }
        };

        // 预留底部品牌条空间
        const baseComputeSize = nodeType.prototype.computeSize;
        nodeType.prototype.computeSize = function (out) {
            const r = baseComputeSize
                ? baseComputeSize.apply(this, arguments)
                : (out || [200, 100]);
            if (!this.flags || !this.flags.collapsed) r[1] += 28;
            return r;
        };
    },
});
