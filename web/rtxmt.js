/**
 * ComfyUI-NVIDIA-RTX-Media-Toolkit — frontend theme
 * NVIDIA black/green branding for all RTXMT_* nodes.
 * - #76B900 NVIDIA green accents, deep-black panels, high-contrast widgets
 * - Brand footer bar with per-node capability badge (DLISR / VSR / RIFE ...)
 * - Collapsed-mode green header strip
 */
import { app } from "../../scripts/app.js";

const THEME = {
    green: "#76B900",
    greenBright: "#8fd400",
    greenDark: "#4a7300",
    black: "#0b0e07",
    panel: "#141a10",
    border: "#2e3b1c",
    text: "#e8f0dd",
    textDim: "#9fb08a",
    badgeText: "#101400",
};

const BADGES = {
    RTXMT_DLISR_Upscale: "DLISR · PHOTO 2x/4x/8x",
    RTXMT_VSR_Upscale: "VSR · VIDEO",
    RTXMT_VSR_Upscale_Tiled: "VSR · TILED",
    RTXMT_FrameInterpolate: "RIFE · INTERP",
    RTXMT_VideoPipeline: "VSR + RIFE",
    RTXMT_ModelManager: "DRIVER / MODELS",
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
    const h = 24;
    const w = node.size[0];
    const y = node.size[1] - h;
    if (y < 30) return;

    ctx.save();
    // gradient green footer
    const g = ctx.createLinearGradient(0, y, w, y + h);
    g.addColorStop(0, THEME.green);
    g.addColorStop(1, THEME.greenDark);
    ctx.fillStyle = g;
    roundRectPath(ctx, 1, y, w - 2, h - 1, 7);
    ctx.fill();

    // eye symbol (NVIDIA-ish) — small green-on-black square glyph
    ctx.fillStyle = THEME.black;
    roundRectPath(ctx, 7, y + 5, 14, 14, 3);
    ctx.fill();
    ctx.fillStyle = THEME.greenBright;
    ctx.beginPath();
    ctx.ellipse(14, y + 12, 5.2, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = THEME.black;
    ctx.beginPath();
    ctx.arc(14, y + 12, 1.7, 0, Math.PI * 2);
    ctx.fill();

    // text
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = "bold 11px 'Segoe UI', 'Microsoft YaHei', Arial, sans-serif";
    ctx.fillStyle = THEME.badgeText;
    ctx.fillText("NVIDIA RTX", 26, y + h / 2 + 0.5);

    ctx.textAlign = "right";
    ctx.font = "bold 10px 'Segoe UI', 'Microsoft YaHei', Consolas, monospace";
    ctx.fillStyle = THEME.black;
    ctx.fillText(badge, w - 9, y + h / 2 + 0.5);
    ctx.restore();
}

function drawCollapsedStrip(ctx, node, badge) {
    ctx.save();
    ctx.fillStyle = THEME.green;
    roundRectPath(ctx, 1, 1, node.size[0] - 2, node.size[1] - 2, 6);
    ctx.fill();
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.font = "bold 12px 'Segoe UI', Arial";
    ctx.fillStyle = THEME.black;
    ctx.fillText("NVIDIA RTX · " + badge, 10, node.size[1] / 2 + 0.5);
    ctx.restore();
}

app.registerExtension({
    name: "RTXMT.NVIDIA-Theme",

    beforeRegisterNodeDef(nodeType, nodeData) {
        if (!nodeData.name || !nodeData.name.startsWith("RTXMT_")) return;
        const badge = BADGES[nodeData.name] || "RTX";

        const baseOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = baseOnNodeCreated ? baseOnNodeCreated.apply(this, arguments) : undefined;
            this.color = THEME.green;          // title bar
            this.bgcolor = THEME.panel;        // body
            if ("title_color" in this) this.title_color = THEME.black;
            if ("title_text_color" in this) this.title_text_color = THEME.black;
            this._rtxBadge = badge;
            return r;
        };

        const baseDrawBg = nodeType.prototype.onDrawBackground;
        nodeType.prototype.onDrawBackground = function (ctx) {
            if (baseDrawBg) baseDrawBg.apply(this, arguments);
            try {
                if (this.flags && this.flags.collapsed) {
                    drawCollapsedStrip(ctx, this, this._rtxBadge || badge);
                } else {
                    drawBrandBar(ctx, this, this._rtxBadge || badge);
                }
            } catch (e) { /* never break the graph */ }
        };

        // keep the footer below widgets: grow node a touch on first size
        const baseOnResize = nodeType.prototype.onResize;
        nodeType.prototype.onResize = function (size) {
            const r = baseOnResize ? baseOnResize.apply(this, arguments) : undefined;
            if (!this.flags || !this.flags.collapsed) {
                if (!this._rtxPadApplied) {
                    this._rtxPadApplied = true;
                    size[1] += 26;
                }
            }
            return r;
        };
    },

    // high-contrast tweak: make combo/text widgets readable on dark panels
    nodeCreated(node) {
        if (!node.widgets) return;
        for (const w of node.widgets) {
            if (w.type === "combo" || w.type === "text" || w.type === "number") {
                if ("advanced" in w) w.advanced = w.advanced; // no-op, keep layout
            }
        }
    },
});
