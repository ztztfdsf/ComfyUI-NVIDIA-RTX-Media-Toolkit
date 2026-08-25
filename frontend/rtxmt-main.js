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

// NVIDIA 官方 eye SVG path（抓取自 nvidia.com 官方 logo）
const NV_EYE_PATH = "M11.6925 17.7697V15.8762C11.8738 15.8633 12.0563 15.8528 12.2422 15.847C17.3372 15.6837 20.68 20.2978 20.68 20.2978C20.68 20.2978 17.0699 25.3962 13.1992 25.3962C12.6415 25.3962 12.1423 25.3052 11.6925 25.1511V19.4077C13.6766 19.6515 14.0748 20.5417 15.2671 22.5623L17.919 20.2885C17.919 20.2885 15.9831 17.7067 12.7195 17.7067C12.3649 17.7067 12.0253 17.7323 11.6913 17.7685L11.6925 17.7697ZM11.6913 11.5128V14.342C11.8738 14.3268 12.0574 14.3152 12.241 14.3082C19.3259 14.0655 23.9425 20.2162 23.9425 20.2162C23.9425 20.2162 18.6408 26.7705 13.1166 26.7705C12.6105 26.7705 12.1366 26.7227 11.6913 26.6433V28.3922C12.0723 28.4412 12.4671 28.4703 12.8779 28.4703C18.0177 28.4703 21.7358 25.8021 25.3356 22.6428C25.9323 23.1281 28.3754 24.31 28.8781 24.828C25.4549 27.7412 17.4795 30.0885 12.9571 30.0885C12.521 30.0885 12.1022 30.0617 11.6913 30.022V32.479H31.2282V11.514H11.6925L11.6913 11.5128ZM11.6913 25.15V26.6433C6.93708 25.7812 5.6174 20.7575 5.6174 20.7575C5.6174 20.7575 7.89986 18.1862 11.6913 17.7697V19.4077C11.6913 19.4077 11.6867 19.4077 11.6845 19.4077C9.69462 19.165 8.14085 21.055 8.14085 21.055C8.14085 21.055 9.01183 24.2365 11.6925 25.1523L11.6913 25.15ZM3.24888 20.5417C3.24888 20.5417 6.06609 16.3148 11.6925 15.8773V14.3443C5.46134 14.853 0.0644531 20.2185 0.0644531 20.2185C0.0644531 20.2185 3.12036 29.2018 11.6925 30.0243V28.3945C5.40167 27.5895 3.24888 20.5417 3.24888 20.5417Z";
const NV_EYE_BBOX = { x: 3.24888, y: 0.0644531, w: 29.2301, h: 31.1637 };

// NVIDIA 风格 eye：左实心旋涡半圆 + 右开口弧线（官方 logo 特征）
function drawNvEye(ctx, x, y, size, fg, bg) {
    ctx.save();
    ctx.fillStyle = bg;
    roundRectPath(ctx, x, y, size, size, size * 0.2);
    ctx.fill();
    const s = (size * 0.74) / NV_EYE_BBOX.h;
    const ox = x + (size - NV_EYE_BBOX.w * s) / 2 - NV_EYE_BBOX.x * s;
    const oy = y + (size - NV_EYE_BBOX.h * s) / 2 - NV_EYE_BBOX.y * s;
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    ctx.fillStyle = fg;
    ctx.fill(new Path2D(NV_EYE_PATH));
    ctx.restore();
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
    // NVIDIA eye 标
    drawNvEye(ctx, 8, y + 5, 16, THEME.greenBright, THEME.black);
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

// ---- ⚙ 设置弹窗（走 /rtxmt/* 自定义 API）----------------------------------
const EYE_PATH_STR = "M11.6925 17.7697V15.8762C11.8738 15.8633 12.0563 15.8528 12.2422 15.847C17.3372 15.6837 20.68 20.2978 20.68 20.2978C20.68 20.2978 17.0699 25.3962 13.1992 25.3962C12.6415 25.3962 12.1423 25.3052 11.6925 25.1511V19.4077C13.6766 19.6515 14.0748 20.5417 15.2671 22.5623L17.919 20.2885C17.919 20.2885 15.9831 17.7067 12.7195 17.7067C12.3649 17.7067 12.0253 17.7323 11.6913 17.7685L11.6925 17.7697ZM11.6913 11.5128V14.342C11.8738 14.3268 12.0574 14.3152 12.241 14.3082C19.3259 14.0655 23.9425 20.2162 23.9425 20.2162C23.9425 20.2162 18.6408 26.7705 13.1166 26.7705C12.6105 26.7705 12.1366 26.7227 11.6913 26.6433V28.3922C12.0723 28.4412 12.4671 28.4703 12.8779 28.4703C18.0177 28.4703 21.7358 25.8021 25.3356 22.6428C25.9323 23.1281 28.3754 24.31 28.8781 24.828C25.4549 27.7412 17.4795 30.0885 12.9571 30.0885C12.521 30.0885 12.1022 30.0617 11.6913 30.022V32.479H31.2282V11.514H11.6925L11.6913 11.5128ZM11.6913 25.15V26.6433C6.93708 25.7812 5.6174 20.7575 5.6174 20.7575C5.6174 20.7575 7.89986 18.1862 11.6913 17.7697V19.4077C11.6913 19.4077 11.6867 19.4077 11.6845 19.4077C9.69462 19.165 8.14085 21.055 8.14085 21.055C8.14085 21.055 9.01183 24.2365 11.6925 25.1523L11.6913 25.15ZM3.24888 20.5417C3.24888 20.5417 6.06609 16.3148 11.6925 15.8773V14.3443C5.46134 14.853 0.0644531 20.2185 0.0644531 20.2185C0.0644531 20.2185 3.12036 29.2018 11.6925 30.0243V28.3945C5.40167 27.5895 3.24888 20.5417 3.24888 20.5417Z";
const EYE_VB = "3.2 0 29.3 31.2";


async function fetchJSON(url, opts) {
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
}

// 样式注入（一次性）
function ensureRtxmtStyles() {
    if (document.getElementById("rtxmt-styles")) return;
    const st = document.createElement("style");
    st.id = "rtxmt-styles";
    st.textContent = `
@keyframes rtxmt-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes rtxmt-pop { from { opacity: 0; transform: scale(.92) translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes rtxmt-spin { to { transform: rotate(360deg); } }
@keyframes rtxmt-pulse { 0%,100% { opacity: .45 } 50% { opacity: 1 } }
#rtxmt-settings-dlg { animation: rtxmt-fade .18s ease-out; }
#rtxmt-settings-dlg .panel { animation: rtxmt-pop .22s cubic-bezier(.34,1.4,.64,1); }
#rtxmt-settings-dlg button[data-act] { transition: background .15s, transform .08s; }
#rtxmt-settings-dlg button[data-act]:hover:not(:disabled) { background: #1d2617 !important; }
#rtxmt-settings-dlg button[data-act]:active:not(:disabled) { transform: scale(.97); }
#rtxmt-settings-dlg button[data-act][data-primary]:hover:not(:disabled) { background: #8fd400 !important; }
#rtxmt-settings-dlg button:disabled { opacity: .45; cursor: wait !important; }
.rtxmt-spin { display:inline-block; width:14px; height:14px; border:2px solid rgba(118,185,0,.25);
  border-top-color:#76B900; border-radius:50%; animation: rtxmt-spin .7s linear infinite; vertical-align:-2px; margin-right:6px; }
.rtxmt-row { display:flex; align-items:center; gap:10px; background:#0b0d09; border:1px solid #2e3b1c;
  border-radius:8px; padding:9px 12px; margin-bottom:7px; transition: border-color .15s; }
.rtxmt-row:hover { border-color:#76B900; }
.rtxmt-dot { width:9px; height:9px; border-radius:50%; flex:none; }
.rtxmt-badge { font-size:11px; padding:3px 10px; border-radius:10px; font-weight:600; }
`;
    document.head.appendChild(st);
}

// 模型全部就位后：灰掉所有 RTXMT 节点的「自动下载模型」
// 采用重试机制（节点 widgets 可能尚未就绪）
function applyAutoDownloadLock(allReady, attempt = 0) {
    if (!allReady) return;
    let changed = false;
    for (const node of app.graph._nodes || []) {
        if (!node.type || !node.type.startsWith("RTXMT")) continue;
        for (const w of node.widgets || []) {
            if (w.name === "auto_download") {
                if (!w.disabled) { w.disabled = true; changed = true; }
                try { if (w.element) w.element.disabled = true; } catch (e) {}
                try { if (w.label !== undefined && !w.label.includes("（已就位")) w.label = "自动下载模型（模型已就位）"; } catch (e) {}
            }
        }
    }
    if (changed) {
        for (const node of app.graph._nodes || []) {
            if (node.type?.startsWith("RTXMT")) node.setSize(node.computeSize());
        }
        app.graph.change();
        return;
    }
    if (attempt < 6) setTimeout(() => applyAutoDownloadLock(true, attempt + 1), 800);
}

let _settingsRefreshTimer = null;

function openSettingsDialog() {
    ensureRtxmtStyles();
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
    panel.className = "panel";
    Object.assign(panel.style, {
        width: "500px", background: "#101210", border: "1px solid #2e3b1c",
        borderRadius: "12px", boxShadow: "0 12px 48px rgba(0,0,0,.6)", overflow: "hidden",
        color: "#e8f0dd",
    });
    panel.innerHTML = `
      <div style="background:linear-gradient(90deg,#76B900,#4a7300);padding:10px 14px;display:flex;align-items:center;gap:8px;">
        <span style="font-weight:700;color:#0e1206;font-size:14px;">NVIDIA RTX · 模型与驱动设置</span>
        <span style="flex:1"></span>
        <span id="rtxmt-close" style="cursor:pointer;color:#0e1206;font-weight:700;font-size:16px;padding:0 4px;">✕</span>
      </div>
      <div style="padding:14px;">
        <div style="display:flex;align-items:center;gap:10px;background:#0b0d09;border:1px solid #2e3b1c;border-radius:8px;padding:10px 12px;margin-bottom:10px;">
          <div style="width:30px;height:30px;border-radius:6px;background:#000;display:flex;align-items:center;justify-content:center;">
            <svg width="18" height="18" viewBox="3.2 0 29.3 31.2"><path fill="#76B900" d="M11.6925 17.7697V15.8762C11.8738 15.8633 12.0563 15.8528 12.2422 15.847C17.3372 15.6837 20.68 20.2978 20.68 20.2978C20.68 20.2978 17.0699 25.3962 13.1992 25.3962C12.6415 25.3962 12.1423 25.3052 11.6925 25.1511V19.4077C13.6766 19.6515 14.0748 20.5417 15.2671 22.5623L17.919 20.2885C17.919 20.2885 15.9831 17.7067 12.7195 17.7067C12.3649 17.7067 12.0253 17.7323 11.6913 17.7685L11.6925 17.7697ZM11.6913 11.5128V14.342C11.8738 14.3268 12.0574 14.3152 12.241 14.3082C19.3259 14.0655 23.9425 20.2162 23.9425 20.2162C23.9425 20.2162 18.6408 26.7705 13.1166 26.7705C12.6105 26.7705 12.1366 26.7227 11.6913 26.6433V28.3922C12.0723 28.4412 12.4671 28.4703 12.8779 28.4703C18.0177 28.4703 21.7358 25.8021 25.3356 22.6428C25.9323 23.1281 28.3754 24.31 28.8781 24.828C25.4549 27.7412 17.4795 30.0885 12.9571 30.0885C12.521 30.0885 12.1022 30.0617 11.6913 30.022V32.479H31.2282V11.514H11.6925L11.6913 11.5128ZM11.6913 25.15V26.6433C6.93708 25.7812 5.6174 20.7575 5.6174 20.7575C5.6174 20.7575 7.89986 18.1862 11.6913 17.7697V19.4077C11.6913 19.4077 11.6867 19.4077 11.6845 19.4077C9.69462 19.165 8.14085 21.055 8.14085 21.055C8.14085 21.055 9.01183 24.2365 11.6925 25.1523L11.6913 25.15ZM3.24888 20.5417C3.24888 20.5417 6.06609 16.3148 11.6925 15.8773V14.3443C5.46134 14.853 0.0644531 20.2185 0.0644531 20.2185C0.0644531 20.2185 3.12036 29.2018 11.6925 30.0243V28.3945C5.40167 27.5895 3.24888 20.5417 3.24888 20.5417Z"/></svg>
          </div>
          <div>
            <div id="rtxmt-gpu-name" style="font-weight:700;font-size:13px;color:#f2f6ea;">
              <span class="rtxmt-spin"></span>检测中…
            </div>
            <div id="rtxmt-gpu-sub" style="font-size:11px;color:#7d8a6a;"></div>
          </div>
        </div>
        <div id="rtxmt-rows">
          <div class="rtxmt-row" style="opacity:.5"><span class="rtxmt-spin"></span><span style="font-size:12px;">正在检查组件状态…</span></div>
        </div>
        <div id="rtxmt-prog-wrap" hidden>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#9fb08a;margin-bottom:4px;">
            <span id="rtxmt-prog-label">下载中…</span><span id="rtxmt-prog-pct">0%</span>
          </div>
          <div style="height:8px;background:#0b0d09;border-radius:4px;overflow:hidden;border:1px solid #2e3b1c;">
            <div id="rtxmt-prog-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#76B900,#8fd400);transition:width .4s;"></div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button data-act="status"   style="flex:1;padding:8px 0;border:1px solid #76B900;background:#141a10;color:#cfe0b8;border-radius:6px;cursor:pointer;">刷新状态</button>
          <button data-act="sdk"      style="flex:1;padding:8px 0;border:1px solid #76B900;background:#141a10;color:#cfe0b8;border-radius:6px;cursor:pointer;">下载 VSR 引擎</button>
          <button data-act="rife"     style="flex:1;padding:8px 0;border:1px solid #76B900;background:#141a10;color:#cfe0b8;border-radius:6px;cursor:pointer;">下载 RIFE 模型</button>
          <button data-act="all" data-primary style="flex:1;padding:8px 0;border:none;background:#76B900;color:#0e1206;font-weight:700;border-radius:6px;cursor:pointer;">一键全部下载</button>
        </div>
        <div id="rtxmt-log" style="margin-top:10px;font-size:11px;color:#7d8a6a;min-height:16px;"></div>
      </div>`;
    mask.appendChild(panel);
    document.body.appendChild(mask);
    panel.innerHTML = panel.innerHTML.replace("M11.6925 17.7697V15.8762C11.8738 15.8633 12.0563 15.8528 12.2422 15.847C17.3372 15.6837 20.68 20.2978 20.68 20.2978C20.68 20.2978 17.0699 25.3962 13.1992 25.3962C12.6415 25.3962 12.1423 25.3052 11.6925 25.1511V19.4077C13.6766 19.6515 14.0748 20.5417 15.2671 22.5623L17.919 20.2885C17.919 20.2885 15.9831 17.7067 12.7195 17.7067C12.3649 17.7067 12.0253 17.7323 11.6913 17.7685L11.6925 17.7697ZM11.6913 11.5128V14.342C11.8738 14.3268 12.0574 14.3152 12.241 14.3082C19.3259 14.0655 23.9425 20.2162 23.9425 20.2162C23.9425 20.2162 18.6408 26.7705 13.1166 26.7705C12.6105 26.7705 12.1366 26.7227 11.6913 26.6433V28.3922C12.0723 28.4412 12.4671 28.4703 12.8779 28.4703C18.0177 28.4703 21.7358 25.8021 25.3356 22.6428C25.9323 23.1281 28.3754 24.31 28.8781 24.828C25.4549 27.7412 17.4795 30.0885 12.9571 30.0885C12.521 30.0885 12.1022 30.0617 11.6913 30.022V32.479H31.2282V11.514H11.6925L11.6913 11.5128ZM11.6913 25.15V26.6433C6.93708 25.7812 5.6174 20.7575 5.6174 20.7575C5.6174 20.7575 7.89986 18.1862 11.6913 17.7697V19.4077C11.6913 19.4077 11.6867 19.4077 11.6845 19.4077C9.69462 19.165 8.14085 21.055 8.14085 21.055C8.14085 21.055 9.01183 24.2365 11.6925 25.1523L11.6913 25.15ZM3.24888 20.5417C3.24888 20.5417 6.06609 16.3148 11.6925 15.8773V14.3443C5.46134 14.853 0.0644531 20.2185 0.0644531 20.2185C0.0644531 20.2185 3.12036 29.2018 11.6925 30.0243V28.3945C5.40167 27.5895 3.24888 20.5417 3.24888 20.5417Z", EYE_PATH_STR).replace("3.2 0 29.3 31.2", EYE_VB);

    const rows = panel.querySelector("#rtxmt-rows");
    const progWrap = panel.querySelector("#rtxmt-prog-wrap");
    progWrap.hidden = true;
    const logEl = panel.querySelector("#rtxmt-log");
    const busy = b => { panel.querySelectorAll("button[data-act]").forEach(x => x.disabled = b); };

    function renderRows(d) {
        const mk = (name, sub, ok, okText, badText) => {
            const color = ok ? "#76B900" : "#d9534f";
            const badgeBg = ok ? "rgba(118,185,0,.15)" : "rgba(217,83,79,.15)";
            return `<div class="rtxmt-row">
              <span class="rtxmt-dot" style="background:${color};box-shadow:0 0 6px ${color};"></span>
              <div style="flex:1">
                <div style="font-size:13px;color:#f2f6ea;">${name}</div>
                <div style="font-size:11px;color:#7d8a6a;">${sub}</div>
              </div>
              <span class="rtxmt-badge" style="background:${badgeBg};color:${color};">${ok ? okText : badText}</span>
            </div>`;
        };
        rows.innerHTML =
            mk("VSR 视频超分引擎", "RTX Video Super Resolution · 约 750 MB", !!d.vsr_installed, "已就位", "未安装")
          + mk("RIFE 插帧模型", "帧率倍增 2x / 4x / 8x · 约 21 MB", !!d.rife_installed, "已就位", "未安装")
          + mk("DLISR 照片AI超分", "驱动 NGX 管线 · 免模型", true, "免模型", "");
    }

    async function refresh() {
        // 立即显示 loading（消除黑箱感）
        busy(true);
        rows.innerHTML = `<div class="rtxmt-row" style="opacity:.5"><span class="rtxmt-spin"></span><span style="font-size:12px;color:#9fb08a;">正在检查组件状态…</span></div>`;
        panel.querySelector("#rtxmt-gpu-name").innerHTML = '<span class="rtxmt-spin"></span>检测中…';
        panel.querySelector("#rtxmt-gpu-sub").textContent = "";
        progWrap.hidden = false;
        const bar = panel.querySelector("#rtxmt-prog-bar");
        bar.style.width = "100%";
        bar.style.background = "linear-gradient(90deg,#76B900,#8fd400)";
        bar.style.animation = "rtxmt-pulse 1.2s ease-in-out infinite";
        panel.querySelector("#rtxmt-prog-label").textContent = "正在查询…";
        panel.querySelector("#rtxmt-prog-pct").textContent = "";

        try {
            const d = await fetchJSON("/rtxmt/status");
            bar.style.animation = "";
            progWrap.hidden = true;
            renderRows(d);
            panel.querySelector("#rtxmt-gpu-name").textContent = d.gpu || "未知设备";
            panel.querySelector("#rtxmt-gpu-sub").textContent = `${d.label ?? ""} ${d.sm ?? ""}`;
            applyAutoDownloadLock(d.all_ready);

            const t = d.task || {};
            if (t.running) {
                progWrap.hidden = false;
                bar.style.animation = "";
                const pct = Math.max(0, Math.min(100, t.pct ?? 0));
                panel.querySelector("#rtxmt-prog-pct").textContent = pct.toFixed(1) + "%";
                bar.style.width = pct + "%";
                panel.querySelector("#rtxmt-prog-label").textContent = "后台任务进行中…";
                logEl.textContent = (t.log || []).slice(-1).join(" ") || "";
                busy(true);
                clearTimeout(_settingsRefreshTimer);
                _settingsRefreshTimer = setTimeout(refresh, 1000);
            } else {
                progWrap.hidden = true;
                logEl.textContent = t.done ? "上次任务已完成" : "";
                clearTimeout(_settingsRefreshTimer);
                busy(false);
            }
        } catch (e) {
            bar.style.animation = "";
            progWrap.hidden = true;
            logEl.textContent = "状态获取失败：" + e.message;
            busy(false);
        }
    }

    panel.querySelector("#rtxmt-close").onclick = () => { clearTimeout(_settingsRefreshTimer); mask.remove(); };
    mask.onclick = e => { if (e.target === mask) { clearTimeout(_settingsRefreshTimer); mask.remove(); } };
    panel.querySelectorAll("button[data-act]").forEach(b => b.onclick = async () => {
        const act = b.dataset.act;
        if (act === "status") {
            b.textContent = "刷新中…"; b.disabled = true;
            await refresh();
            // refresh 里 busy(false) 会恢复
            return;
        }
        const oldText = b.textContent;
        b.textContent = "启动中…"; b.disabled = true;
        try {
            await fetchJSON("/rtxmt/download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: act }) });
            b.textContent = oldText;
        } catch (e) {
            b.textContent = oldText;
            logEl.textContent = "启动失败：" + e.message;
        }
        await refresh();
    });
    refresh();
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
                    if (nodeData.name === "RTXMT_ImageUpscale" || nodeData.name === "RTXMT_VideoEnhance") {
                        if (!(this.widgets || []).some(w => w.type === "button")) {
                            try { addSettingsButton(this); } catch (e) {}
                        }
                    }
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
                    // 标题右侧 NVIDIA 眼形标（标题区在节点体上方，负坐标）
                    const th = LiteGraph.NODE_TITLE_HEIGHT || 30;
                    const bs = 17;
                    const bx = this.size[0] - bs - 12;
                    const by = -th / 2 - bs / 2;
                    ctx.fillStyle = THEME.black;
                    roundRectPath(ctx, bx, by, bs, bs, 3.5);
                    ctx.fill();
                    ctx.fillStyle = THEME.greenBright;
                    ctx.beginPath();
                    ctx.ellipse(bx + bs / 2, by + bs / 2, bs * 0.34, bs * 0.23, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = THEME.black;
                    ctx.beginPath();
                    ctx.arc(bx + bs / 2, by + bs / 2, bs * 0.11, 0, Math.PI * 2);
                    ctx.fill();
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

window.__rtxmtLoaded = true;
try { console.log("[RTX-Media-Toolkit] 前端扩展已加载"); } catch(e) {}

// ---------------------------------------------------------------------------
// \u65f6\u5e8f\u514d\u75ab\uff1a\u8f6e\u8be2\u5904\u7406\u6240\u6709 RTXMT \u8282\u70b9\uff08\u4e0d\u4f9d\u8d56\u94a9\u5b50\u65f6\u5e8f\uff09
// ---------------------------------------------------------------------------
(function () {
    if (window.__rtxmtPoller) return;
    window.__rtxmtPoller = true;
    const done = new WeakSet();
    function processAll() {
        try {
            for (const node of app.graph._nodes || []) {
                if (!node.type || !node.type.startsWith("RTXMT") || done.has(node)) continue;
                done.add(node);
                node.color = "#101210";
                node.bgcolor = "#12140f";
                try { if ("title_color" in node) node.title_color = "#000000"; } catch (e) {}
                if ((node.type === "RTXMT_ImageUpscale" || node.type === "RTXMT_VideoEnhance")
                    && !(node.widgets || []).some(w => w.type === "button")) {
                    try { addSettingsButton(node); } catch (e) {}
                }
                localizeWidgets(node);
                localizeSockets(node);
                if (node.type === "RTXMT_ImageUpscale") { try { applyImageEngineGroups(node); } catch (e) {} }
                if (node.type === "RTXMT_VideoEnhance") { try { applyVideoSwitches(node); } catch (e) {} }
            }
        } catch (e) {}
    }
    setTimeout(processAll, 300);
    setTimeout(processAll, 1500);
    setInterval(processAll, 2000);
    // \u6a21\u578b\u5168\u5c31\u4f4d -> \u7070\u6389\u81ea\u52a8\u4e0b\u8f7d
    let adChecked = false;
    setInterval(async () => {
        if (adChecked) return;
        try {
            const d = await (await fetch("/rtxmt/status")).json();
            if (d.all_ready && d.vsr_installed && d.rife_installed) {
                applyAutoDownloadLock(true);
                adChecked = true;
            }
        } catch (e) {}
    }, 4000);
})();
