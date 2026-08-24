/**
 * ComfyUI-NVIDIA-RTX-Media-Toolkit — 前端（NVIDIA 黑绿风）
 * - 黑底白字标题 + 绿色品牌条 + 中文徽章
 * - 图像/视频节点：按引擎/开关动态显隐参数组
 * - ⚙ 设置按钮：模型与驱动管理（状态检查 / 一键下载），内置到每个节点
 */
import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

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
    RTXMT_ImageUpscale: "图像AI超分 DLISR / VSR",
    RTXMT_VideoEnhance: "视频增强 超分+插帧",
    RTXMT_ModelManager: "驱动与模型",
};

const LABEL_CN = {
    engine: "引擎",
    image: "图像",
    scale: "放大倍数",
    auto_download: "自动下载模型",
    quality_tier: "画质档位",
    preset: "风格预设",
    passes: "超分次数",
    target_long_side: "目标长边",
    manual_model: "手动指定模型",
    model: "模型",
    strength: "强度",
    keep_input_limits: "保持输入尺寸",
    tile_size: "分块尺寸",
    overlap: "重叠像素",
    enable_upscale: "VSR 超分",
    enable_interp: "RIFE 插帧",
    fps_multiplier: "帧率倍增",
    fps_override: "帧率覆盖",
    output_mode: "输出模式",
    images: "图像帧",
    video_path: "视频路径",
    output_path: "输出路径",
};

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

function localizeWidgets(node) {
    for (const w of node.widgets || []) {
        const cn = LABEL_CN[w.name];
        if (cn) { try { w.label = cn; } catch (e) {} }
    }
}

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

// ---- 动态显隐 -------------------------------------------------------------
function setWidgetVisible(w, show) {
    if (!w) return;
    w.hidden = !show;
    if (!show) {
        if (!w._rtxSize) { w._rtxSize = w.computeSize; }
        w.computeSize = () => [0, -4];
    } else if (w._rtxSize) {
        w.computeSize = w._rtxSize;
        w._rtxSize = null;
    }
}

function applyImageEngineGroups(node) {
    const ew = (node.widgets || []).find(w => w.name === "engine");
    const engine = ew ? ew.value : "";
    const vis = engine.startsWith("DLISR") ? { group: "scale" }
        : engine.includes("分块") ? { group: "tiled" }
        : { group: "vsr" };
    for (const w of node.widgets || []) {
        if (w.type === "button" || ["engine", "image", "auto_download"].includes(w.name)) { setWidgetVisible(w, true); continue; }
        const names = { scale: ["scale"], vsr: ["quality_tier", "preset", "passes", "target_long_side", "manual_model", "model", "strength", "keep_input_limits"], tiled: ["model", "strength", "tile_size", "overlap"] };
        const show = (names[vis.group] || []).includes(w.name);
        setWidgetVisible(w, show);
    }
    node.setSize(node.computeSize());
}

function applyVideoSwitches(node) {
    const get = n => (node.widgets || []).find(w => w.name === n)?.value;
    const up = get("enable_upscale"), interp = get("enable_interp");
    for (const w of node.widgets || []) {
        if (w.type === "button") { setWidgetVisible(w, true); continue; }
        if (w.name === "quality_tier" || w.name === "preset") setWidgetVisible(w, up !== false);
        if (w.name === "fps_multiplier") setWidgetVisible(w, interp !== false);
    }
    node.setSize(node.computeSize());
}

// ---- ⚙ 设置弹窗 -----------------------------------------------------------
function runManagerAction(action, onDone) {
    const workflow = {
        prompt: {
            "1": { class_type: "RTXMT_ModelManager", inputs: { action }, _meta: { title: "settings" } },
        },
        client_id: "rtxmt-settings",
    };
    return fetch("/prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(workflow) })
        .then(r => r.json())
        .then(({ prompt_id }) => new Promise(resolve => {
            const tick = async () => {
                try {
                    const h = await (await fetch(`/history/${prompt_id}`)).json();
                    if (h[prompt_id] && h[prompt_id].status?.completed) {
                        const outs = h[prompt_id].outputs?.["1"]?.ui?.text
                            || h[prompt_id].outputs?.["1"]?.string
                            || [];
                        const text = Array.isArray(outs) ? outs.join("\n") : String(outs ?? "完成");
                        resolve(text);
                        onDone && onDone(text);
                        return;
                    }
                } catch (e) { /* ignore */ }
                setTimeout(tick, 1500);
            };
            tick();
        }));
}

function openSettingsDialog() {
    const old = document.getElementById("rtxmt-settings-dlg");
    if (old) old.remove();
    const mask = document.createElement("div");
    mask.id = "rtxmt-settings-dlg";
    Object.assign(mask.style, {
        position: "fixed", inset: "0", zIndex: 99999, background: "rgba(0,0,0,.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Segoe UI','Microsoft YaHei',sans-serif",
    });
    const panel = document.createElement("div");
    Object.assign(panel.style, {
        width: "460px", background: "#101210", border: "1px solid #2e3b1c",
        borderRadius: "10px", boxShadow: "0 12px 48px rgba(0,0,0,.6)", overflow: "hidden",
        color: "#e8f0dd",
    });
    panel.innerHTML = `
      <div style="background:linear-gradient(90deg,#76B900,#4a7300);padding:10px 14px;display:flex;align-items:center;gap:8px;">
        <span style="font-weight:700;color:#0e1206;font-size:14px;">NVIDIA RTX · 模型与驱动设置</span>
        <span style="flex:1"></span>
        <span id="rtxmt-close" style="cursor:pointer;color:#0e1206;font-weight:700;font-size:16px;padding:0 4px;">✕</span>
      </div>
      <div style="padding:14px;">
        <div id="rtxmt-status" style="background:#0b0d09;border:1px solid #2e3b1c;border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.7;white-space:pre-wrap;min-height:88px;color:#cfe0b8;">正在检查状态…</div>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button data-act="检查状态"   style="flex:1;padding:8px 0;border:1px solid #76B900;background:#141a10;color:#cfe0b8;border-radius:6px;cursor:pointer;">检查状态</button>
          <button data-act="下载SDK引擎" style="flex:1;padding:8px 0;border:1px solid #76B900;background:#141a10;color:#cfe0b8;border-radius:6px;cursor:pointer;">下载 VSR 引擎</button>
          <button data-act="下载RIFE模型" style="flex:1;padding:8px 0;border:1px solid #76B900;background:#141a10;color:#cfe0b8;border-radius:6px;cursor:pointer;">下载 RIFE 模型</button>
          <button data-act="全部下载"   style="flex:1;padding:8px 0;border:none;background:#76B900;color:#0e1206;font-weight:700;border-radius:6px;cursor:pointer;">一键全部下载</button>
        </div>
        <div style="margin-top:10px;font-size:11px;color:#7d8a6a;">VSR 引擎约 750 MB（按显卡架构自动选择），RIFE 模型约 21 MB；DLISR 照片超分无需下载模型。</div>
      </div>`;
    mask.appendChild(panel);
    document.body.appendChild(mask);
    const status = panel.querySelector("#rtxmt-status");
    const busy = (b) => { panel.querySelectorAll("button[data-act]").forEach(x => x.disabled = b); };
    const run = (act) => {
        busy(true);
        status.textContent = `正在执行：${act} …（下载可能需要几分钟，请勿关闭）`;
        runManagerAction(act, text => { status.textContent = text || "完成"; busy(false); });
    };
    panel.querySelector("#rtxmt-close").onclick = () => mask.remove();
    mask.onclick = e => { if (e.target === mask) mask.remove(); };
    panel.querySelectorAll("button[data-act]").forEach(b => b.onclick = () => run(b.dataset.act));
    run("检查状态");
}

function addSettingsButton(node) {
    const btn = node.addWidget("button", "⚙ 模型与驱动设置", null, () => openSettingsDialog());
    btn.label = "⚙ 模型与驱动设置";
    btn.serialize = false;
    // 移到 widget 列表最前（image 输入之后视觉更顺）
    const idx = node.widgets.indexOf(btn);
    if (idx > 0) node.widgets.splice(0, 0, node.widgets.splice(idx, 1)[0]);
    return btn;
}

app.registerExtension({
    name: "RTXMT.NVIDIA-Theme",

    beforeRegisterNodeDef(nodeType, nodeData) {
        if (!nodeData.name || !nodeData.name.startsWith("RTXMT_")) return;
        const badge = BADGES[nodeData.name] || "RTX";

        const baseOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = baseOnNodeCreated ? baseOnNodeCreated.apply(this, arguments) : undefined;
            this.color = THEME.titleBg;
            this.bgcolor = THEME.panel;
            localizeWidgets(this);
            if (nodeData.name === "RTXMT_ImageUpscale" || nodeData.name === "RTXMT_VideoEnhance") {
                addSettingsButton(this);
            }
            const sync = () => {
                try {
                    localizeWidgets(this);
                    localizeSockets(this);
                    if (nodeData.name === "RTXMT_ImageUpscale") applyImageEngineGroups(this);
                    if (nodeData.name === "RTXMT_VideoEnhance") applyVideoSwitches(this);
                } catch (e) {}
            };
            sync();
            setTimeout(sync, 0);
            setTimeout(sync, 400);
            const baseWidgetCb = this.onWidgetChangedHandler;
            for (const w of this.widgets || []) {
                const orig = w.callback;
                w.callback = (...args) => {
                    const v = orig ? orig.apply(this, args) : undefined;
                    sync();
                    return v;
                };
            }
            this._rtxSync = sync;
            return r;
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
                localizeSockets(this);
                localizeWidgets(this);
                if (this.flags && this.flags.collapsed) {
                    drawCollapsedStrip(ctx, this, this._rtxBadge || badge);
                } else {
                    drawBrandBar(ctx, this, this._rtxBadge || badge);
                }
            } catch (e) { /* never break the graph */ }
        };

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
