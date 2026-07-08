const state = {
  projects: [],
  project: null,
  character: null,
  action: null,
  skeletons: [],
  actionTemplates: [],
  selectedTemplateId: "walk_left",
  dataRoot: "",
  provider: "",
  busy: false,
};

const app = document.querySelector("#app");
const pixelSizes = [32, 48, 64, 96, 128];

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function setBusy(value) {
  state.busy = value;
  render();
}

function pixelOptions(selected = 64) {
  return pixelSizes
    .map((size) => `<option value="${size}" ${Number(selected) === size ? "selected" : ""}>${size}x${size}</option>`)
    .join("");
}

function skeletonOptions(selected = "humanoid_basic") {
  return state.skeletons
    .map((skeleton) => `<option value="${skeleton.id}" ${selected === skeleton.id ? "selected" : ""}>${skeleton.name}</option>`)
    .join("");
}

function skeletonById(id = "humanoid_basic") {
  return state.skeletons.find((skeleton) => skeleton.id === id) || state.skeletons[0] || null;
}

function characterSkeleton() {
  return state.character?.skeleton_config || skeletonById(state.character?.skeleton_id || "humanoid_basic");
}

function templateById(id) {
  return state.actionTemplates.find((template) => template.id === id) || state.actionTemplates[0] || null;
}

function selectedActionTemplate() {
  return templateById(state.selectedTemplateId) || templateById("walk_left");
}

function templateFrames(template) {
  return template?.preview_frames || template?.frames || [];
}

function templateSkeleton(template) {
  return characterSkeleton() || skeletonById(template?.skeleton_id || "humanoid_basic");
}

function skeletonPreviewMarkup(source, skeletonId = "humanoid_basic", className = "") {
  return `
    <div class="skeleton-preview">
      <canvas
        class="skeleton-canvas ${className}"
        width="220"
        height="220"
        data-skeleton-preview="${source}"
        data-skeleton-id="${skeletonId}"
      ></canvas>
    </div>
  `;
}

function pointColor(node) {
  if (node.type === "prop") return "#f4c95d";
  if (node.type === "cloth") return "#c987ff";
  if (node.id?.startsWith("left_")) return "#79b8ff";
  if (node.id?.startsWith("right_")) return "#ff8f8f";
  if (node.type === "anchor") return "#7bd88f";
  return "#edf2ef";
}

function drawSkeletonFigure(canvas, skeleton, joints = null, pixelSize = null) {
  if (!canvas || !skeleton) return;
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const logicalSize = Number(pixelSize || skeleton.canvas?.[0] || 64);
  const canvasSize = joints ? [logicalSize, logicalSize] : skeleton.canvas || [64, 64];
  const nodes = (skeleton.nodes || []).filter((node) => Array.isArray(node.default));
  const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const pointMap = joints || Object.fromEntries(nodes.map((node) => [node.id, node.default]));
  const padding = 18;
  const scale = Math.min((width - padding * 2) / canvasSize[0], (height - padding * 2) / canvasSize[1]);
  const offsetX = (width - canvasSize[0] * scale) / 2;
  const offsetY = (height - canvasSize[1] * scale) / 2;
  const mapPoint = (point) => [offsetX + point[0] * scale, offsetY + point[1] * scale];

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#111314";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(255,255,255,0.07)";
  context.lineWidth = 1;
  for (let x = 0; x <= canvasSize[0]; x += 8) {
    const [screenX] = mapPoint([x, 0]);
    context.beginPath();
    context.moveTo(screenX, offsetY);
    context.lineTo(screenX, offsetY + canvasSize[1] * scale);
    context.stroke();
  }
  for (let y = 0; y <= canvasSize[1]; y += 8) {
    const [, screenY] = mapPoint([0, y]);
    context.beginPath();
    context.moveTo(offsetX, screenY);
    context.lineTo(offsetX + canvasSize[0] * scale, screenY);
    context.stroke();
  }

  const skeletonLogicalHeight = Number(skeleton.canvas?.[1] || 64);
  const baseGroundY = Number(skeleton.ground_y ?? skeletonLogicalHeight - 8);
  const groundY = joints ? (baseGroundY / skeletonLogicalHeight) * canvasSize[1] : baseGroundY;
  const [, groundScreenY] = mapPoint([0, groundY]);
  context.strokeStyle = "rgba(244,201,93,0.45)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(offsetX, groundScreenY);
  context.lineTo(offsetX + canvasSize[0] * scale, groundScreenY);
  context.stroke();

  context.lineCap = "round";
  context.lineJoin = "round";
  for (const node of nodes) {
    const parent = node.parent ? nodeMap[node.parent] : null;
    if (!parent) continue;
    const parentPoint = pointMap[parent.id];
    const nodePoint = pointMap[node.id];
    if (!parentPoint || !nodePoint) continue;
    const [x1, y1] = mapPoint(parentPoint);
    const [x2, y2] = mapPoint(nodePoint);
    context.strokeStyle = joints ? pointColor(node) : "rgba(237,242,239,0.58)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  }

  for (const node of nodes) {
    const point = pointMap[node.id];
    if (!point) continue;
    const [x, y] = mapPoint(point);
    context.fillStyle = pointColor(node);
    context.strokeStyle = "#0f1112";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x, y, node.type === "anchor" ? 5 : 4.2, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
}

function drawSkeletonCanvas(canvas, skeleton) {
  drawSkeletonFigure(canvas, skeleton);
}

function drawSkeletonPreviews() {
  document.querySelectorAll("canvas[data-skeleton-preview]").forEach((canvas) => {
    const source = canvas.dataset.skeletonPreview;
    const skeleton = source === "character" ? characterSkeleton() : skeletonById(canvas.dataset.skeletonId);
    drawSkeletonCanvas(canvas, skeleton);
  });
}

function drawPosePreviews() {
  document.querySelectorAll("canvas[data-pose-preview]").forEach((canvas) => {
    const template = templateById(canvas.dataset.templateId);
    const frame = templateFrames(template).find((item) => String(item.index) === canvas.dataset.frameIndex);
    drawSkeletonFigure(canvas, templateSkeleton(template), frame?.joints || null, template?.pixel_size || state.character?.pixel_size || 64);
  });
}

function templatePoseStrip(template, className = "") {
  const frames = templateFrames(template);
  if (!template || !frames.length) return `<div class="empty compact">这个模板还没有 pose 数据。</div>`;
  return `
    <div class="pose-strip ${className}">
      ${frames
        .map(
          (frame) => `
            <div class="pose-frame" title="Frame ${frame.index}: ${frame.label || ""}">
              <canvas
                class="pose-canvas"
                width="132"
                height="132"
                data-pose-preview="template"
                data-template-id="${template.id}"
                data-frame-index="${frame.index}"
              ></canvas>
              <span>${frame.index}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function selectedTemplatePreviewMarkup(template = selectedActionTemplate()) {
  if (!template) return `<div class="empty compact">还没有可用动作模板。</div>`;
  return `
    <div class="template-preview-panel">
      <div class="preview-head">
        <strong>动作模板预览</strong>
        <span>${template.name} · ${template.frame_count} 帧 · ${template.direction}</span>
      </div>
      ${templatePoseStrip(template, "large")}
    </div>
  `;
}

function templateOptions(selected = "walk_left") {
  return state.actionTemplates
    .map((template) => `<option value="${template.id}" ${selected === template.id ? "selected" : ""}>${template.name} · ${template.frame_count} 帧 · ${template.source}</option>`)
    .join("");
}

function layout(side, main) {
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <h1>FrameGrid</h1>
          <span class="badge">Prototype</span>
        </div>
        ${side}
      </aside>
      <main class="main">${main}</main>
    </div>
  `;
}

function imageTile(src, label, large = false) {
  return `
    <div>
      <div class="image-tile ${large ? "large" : ""}">
        ${src ? `<img src="${src}" alt="${label}" />` : ""}
      </div>
      <div class="label">${label}</div>
    </div>
  `;
}

function projectCard(project) {
  return `
    <article class="card">
      <div class="card-title">
        <h3>${project.name}</h3>
        <span class="badge">${project.character_count || 0} 角色</span>
      </div>
      <div class="meta">${project.id}<br />${project.created_at}</div>
      <div class="button-row">
        <button class="primary" data-open-project="${project.id}">进入项目</button>
        <button class="danger" data-delete-project="${project.id}" data-delete-name="${project.name}">删除</button>
      </div>
    </article>
  `;
}

function characterCard(character) {
  return `
    <article class="card">
      <div class="card-title">
        <h3>${character.name}</h3>
        <span class="badge">${character.pixel_size || 64}x${character.pixel_size || 64}</span>
      </div>
      <div class="thumb-row">
        ${imageTile(character.views?.front, "正")}
        ${imageTile(character.views?.side, "侧")}
      </div>
      <div class="meta">${character.skeleton_config?.name || character.skeleton_id || "humanoid_basic"}<br />${character.prompt || "无提示词"}</div>
      <div class="button-row">
        <button class="primary" data-open-character="${character.id}">进入角色</button>
        <button class="danger" data-delete-character="${character.id}" data-delete-name="${character.name}">删除</button>
      </div>
    </article>
  `;
}

function actionCard(action) {
  const template = action.action_template || {};
  return `
    <article class="card">
      <div class="card-title">
        <h3>${action.name}</h3>
        <span class="badge">${action.frame_count} 帧</span>
      </div>
      <div class="image-tile">
        <img class="action-preview" src="${action.preview}" alt="${action.name}" />
      </div>
      <div class="meta">${template.name || action.template_id || "动作模板"} · ${template.direction || "front"}<br />${action.fps} FPS</div>
      <div class="button-row">
        <button class="primary" data-open-action="${action.id}">查看动作</button>
        <button class="danger" data-delete-action="${action.id}" data-delete-name="${action.name}">删除</button>
      </div>
    </article>
  `;
}

function templateCard(template) {
  return `
    <article class="card template-card">
      <div class="card-title">
        <h3>${template.name}</h3>
        <span class="badge">${template.frame_count} 帧</span>
      </div>
      ${templatePoseStrip(template, "mini")}
      <div class="meta">来源：${template.source}<br />骨骼：${template.skeleton_id}<br />方向：${template.direction}</div>
    </article>
  `;
}

function poseGuideTiles(action) {
  const guides = action.pose_guides || action.action_template?.frames?.map((frame) => frame.guide).filter(Boolean) || [];
  if (!guides.length) return `<div class="empty">这个动作还没有骨骼参考图。</div>`;
  return guides.map((guide, index) => imageTile(guide, `pose ${index + 1}`)).join("");
}

function poseRows(action) {
  const frames = action.action_template?.frames || [];
  if (!frames.length) return `<div class="empty">这个动作还没有 pose 数据。</div>`;
  return frames
    .map(
      (frame) => `
        <article class="card">
          <div class="card-title">
            <h3>Frame ${frame.index}: ${frame.label}</h3>
            <span class="badge">${Object.keys(frame.joints || {}).length} 点</span>
          </div>
          <div class="meta">锁定：${Object.entries(frame.locks || {}).filter(([, locked]) => locked).map(([joint]) => joint).join(", ") || "无"}</div>
        </article>
      `,
    )
    .join("");
}

function pixelatedOutputPanel(character) {
  const pixelated = character.pixelated;
  const outputs = pixelated?.outputs || [];
  if (!outputs.length) return "";
  const visibleOutputs = outputs.slice(0, 16);
  return `
    <div style="height: 18px"></div>
    <section class="panel">
      <div class="card-title">
        <h3>最新完美像素化输出</h3>
        <span class="badge">${pixelated.count || outputs.length} 张</span>
      </div>
      <div class="meta">方法：${pixelated.method || "perfect-pixel"} · 采样：${pixelated.sample_method || "majority"} · 兜底次数：${pixelated.fallback_count || 0}</div>
      <div class="frames">${visibleOutputs.map((src, index) => imageTile(src, `pixel ${index + 1}`)).join("")}</div>
    </section>
  `;
}

function editableSourcePanel(character) {
  const editable = character.editable || {};
  const viewCount = Object.keys(editable.views || character.views || {}).length;
  const actionCount = editable.actions?.length || 0;
  return `
    <section class="panel">
      <h3>编辑源文件</h3>
      <div class="meta">
        真相源：editable PNG + manifest.json<br />
        视图：${viewCount} 张 · 动作：${actionCount} 套<br />
        ${editable.path || `${character.path}\\editable`}
      </div>
      <div class="button-row">
        <button type="button" data-open-editable>打开文件夹</button>
        <button type="button" data-sync-editable>同步编辑结果</button>
      </div>
      <button type="button" class="ghost" data-rebuild-editable>从 raw 重建 editable</button>
      <div class="status">${editable.updated_at ? `上次同步：${editable.updated_at}` : "生成角色后会自动创建 editable 源文件。"}</div>
    </section>
  `;
}

function renderHome() {
  layout(
    `
      <section class="side-section">
        <h2>资产目录</h2>
        <div class="crumb">${state.dataRoot || "generated-projects"}</div>
      </section>
      <section class="side-section">
        <h2>图片 Provider</h2>
        <div class="crumb">${state.provider || "codex-imagegen"}</div>
      </section>
      <section class="panel">
        <h3>创建项目</h3>
        <form class="form" id="projectForm">
          <label>项目名称
            <input name="name" value="像素角色项目" />
          </label>
          <button class="primary" ${state.busy ? "disabled" : ""}>创建项目</button>
          <div class="status">${state.busy ? "正在创建项目..." : ""}</div>
        </form>
      </section>
    `,
    `
      <div class="topbar">
        <div>
          <h2>项目列表</h2>
          <p>创建项目后，角色、骨骼和动作模板都会保存在独立项目文件夹里。</p>
        </div>
      </div>
      ${state.projects.length ? `<section class="grid">${state.projects.map(projectCard).join("")}</section>` : `<div class="empty">还没有项目，先创建一个。</div>`}
    `,
  );
}

function renderProject() {
  const project = state.project;
  layout(
    `
      <button class="ghost" data-home>返回项目列表</button>
      <section class="side-section">
        <h2>当前项目</h2>
        <div class="crumb">${project.path}</div>
      </section>
      <button class="danger" data-delete-project="${project.id}" data-delete-name="${project.name}">删除当前项目</button>
      <section class="panel">
        <h3>创建角色</h3>
        <form class="form" id="characterForm">
          <label>角色名称
            <input name="name" value="新角色" />
          </label>
          <label>目标像素尺寸
            <select name="pixel_size">${pixelOptions(64)}</select>
          </label>
          <label>骨骼配置
            <select name="skeleton_id">${skeletonOptions("humanoid_basic")}</select>
          </label>
          ${skeletonPreviewMarkup("select", "humanoid_basic")}
          <label>角色提示词
            <textarea name="prompt">一个穿短斗篷的像素风冒险者，清晰轮廓，适合 2D 游戏动画</textarea>
          </label>
          <button class="primary" ${state.busy ? "disabled" : ""}>生成三视图</button>
          <div class="status">${state.busy ? "正在调用 Codex 生成低分辨率三视图，并自动转成透明背景..." : "角色会绑定一套骨骼配置，后续动作模板会按这套骨骼检查和生成。"}</div>
        </form>
      </section>
    `,
    `
      <div class="topbar">
        <div>
          <h2>${project.name}</h2>
          <p>先创建角色三视图，再进入角色生成或选择动作模板。</p>
        </div>
      </div>
      ${project.characters.length ? `<section class="grid">${project.characters.map(characterCard).join("")}</section>` : `<div class="empty">这个项目还没有角色。</div>`}
    `,
  );
}

function renderCharacter() {
  const character = state.character;
  const size = character.pixel_size || 64;
  const skeletonName = character.skeleton_config?.name || character.skeleton_id || "Humanoid Basic";
  const skeletonId = character.skeleton_config?.id || character.skeleton_id || "humanoid_basic";
  const skeletonNodeCount = character.skeleton_config?.nodes?.length || 19;
  const selectedTemplate = selectedActionTemplate();
  const selectedTemplateId = selectedTemplate?.id || "walk_left";
  layout(
    `
      <button class="ghost" data-back-project>返回项目</button>
      <button class="danger" data-delete-character="${character.id}" data-delete-name="${character.name}">删除当前角色</button>
      <section class="side-section">
        <h2>角色目录</h2>
        <div class="crumb">${character.path}</div>
      </section>
      <section class="side-section">
        <h2>骨骼配置</h2>
        <div class="crumb">${skeletonName}<br />${skeletonNodeCount} 个节点</div>
        ${skeletonPreviewMarkup("character", skeletonId, "large")}
      </section>
      <section class="panel">
        <h3>用模板生成动作</h3>
        <form class="form" id="actionForm">
          <label>动作名称
            <input name="name" value="walk left" />
          </label>
          <label>选择动作模板
            <select name="template_id">${templateOptions(selectedTemplateId)}</select>
          </label>
          <div id="selectedTemplatePreview">${selectedTemplatePreviewMarkup(selectedTemplate)}</div>
          <label>动作提示词
            <textarea name="prompt">根据动作模板骨骼参考图生成角色帧，保持角色外观一致</textarea>
          </label>
          <label>FPS
            <input name="fps" type="number" min="1" max="24" value="8" />
          </label>
          <button class="primary" ${state.busy ? "disabled" : ""}>生成动作帧</button>
          <div class="status">${state.busy ? "正在读取动作模板、渲染骨骼参考图，再逐帧调用 Codex 生图..." : "动作模板已经包含多帧 pose，AI 只负责按 pose guide 画角色。"}</div>
        </form>
      </section>
      <section class="panel">
        <h3>AI 生成新动作模板</h3>
        <form class="form" id="templateForm">
          <label>模板名称
            <input name="name" value="roll left" />
          </label>
          <label>动作描述
            <textarea name="prompt">向左翻滚后站起，动作幅度清晰，脚底最终回到地面</textarea>
          </label>
          <div class="split">
            <label>帧数
              <input name="frame_count" type="number" min="2" max="12" value="6" />
            </label>
            <label>循环
              <select name="loop">
                <option value="true">是</option>
                <option value="false" selected>否</option>
              </select>
            </label>
          </div>
          <button ${state.busy ? "disabled" : ""}>生成并保存模板</button>
          <div class="status">${state.busy ? "正在生成动作模板草稿..." : "会根据当前骨骼生成多帧 pose 和骨骼参考图。"}</div>
        </form>
      </section>
      ${editableSourcePanel(character)}
      <section class="panel">
        <h3>完美像素化</h3>
        <form class="form" id="pixelateForm">
          <label>规整模式
            <select name="method">
              <option value="perfect-pixel" selected>perfectPixel 自动网格</option>
              <option value="perfect-pixel-target">perfectPixel 指定尺寸</option>
              <option value="opencv-area">OpenCV 目标尺寸</option>
            </select>
          </label>
          <label>格内采样
            <select name="sample_method">
              <option value="majority" selected>主色聚类</option>
              <option value="median">中位数</option>
              <option value="center">中心点</option>
            </select>
          </label>
          <div class="split">
            <label>尺寸/兜底
              <select name="grid_size">${pixelOptions(size)}</select>
            </label>
            <label>调色板
              <input name="palette_limit" type="number" min="4" max="64" value="24" />
            </label>
          </div>
          <button ${state.busy ? "disabled" : ""}>生成完美像素图</button>
          <div class="status">${state.busy ? "正在用 perfectPixel 对三视图和动作帧做网格规整..." : "会输出到角色目录的 pixelated 文件夹，并保留透明背景。"}</div>
        </form>
      </section>
    `,
    `
      <div class="topbar">
        <div>
          <h2>${character.name}</h2>
          <p>${character.prompt}</p>
        </div>
      </div>
      <div class="workspace">
        <section class="panel">
          <h3>角色三视图</h3>
          <div class="thumb-row">
            ${imageTile(character.views?.front, "正视图", true)}
            ${imageTile(character.views?.side, "侧视图", true)}
            ${imageTile(character.views?.top, "顶视图", true)}
          </div>
        </section>
        <section class="panel">
          <h3>角色规格</h3>
          <div class="meta">Provider：${character.provider}<br />目标尺寸：${size}x${size}<br />主体高度：${character.pixel_spec?.target_character_height || Math.round(size * 0.75)}px<br />骨骼：${skeletonName}</div>
        </section>
      </div>
      ${pixelatedOutputPanel(character)}
      <div style="height: 18px"></div>
      <section class="panel">
        <h3>可用动作模板</h3>
        <div class="grid">${state.actionTemplates.map(templateCard).join("")}</div>
      </section>
      <div style="height: 18px"></div>
      ${character.actions.length ? `<section class="grid">${character.actions.map(actionCard).join("")}</section>` : `<div class="empty">还没有动作，先选择模板生成一套。</div>`}
    `,
  );
}

function renderAction() {
  const action = state.action;
  layout(
    `
      <button class="ghost" data-back-character>返回角色</button>
      <button class="danger" data-delete-action="${action.id}" data-delete-name="${action.name}">删除当前动作</button>
      <section class="side-section">
        <h2>动作信息</h2>
        <div class="crumb">${action.path}</div>
        <div class="meta">${action.frame_count} 帧，${action.fps} FPS<br />模板：${action.action_template?.name || action.template_id}</div>
      </section>
    `,
    `
      <div class="topbar">
        <div>
          <h2>${action.name}</h2>
          <p>${action.prompt}</p>
        </div>
      </div>
      <section class="panel">
        <h3>动画预览</h3>
        <div class="thumb-row">
          ${imageTile(action.preview, "GIF 预览", true)}
        </div>
      </section>
      <div style="height: 18px"></div>
      <section class="panel">
        <h3>骨骼参考图</h3>
        <div class="frames">${poseGuideTiles(action)}</div>
      </section>
      <div style="height: 18px"></div>
      <section class="panel">
        <h3>Pose 数据</h3>
        <div class="grid">${poseRows(action)}</div>
      </section>
      <div style="height: 18px"></div>
      <section class="panel">
        <h3>Spritesheet</h3>
        <img class="sheet" src="${action.spritesheet}" alt="spritesheet" />
      </section>
      <div style="height: 18px"></div>
      <section class="panel">
        <h3>动作帧</h3>
        <div class="frames">${action.frames.map((frame, index) => imageTile(frame, `frame ${index + 1}`)).join("")}</div>
      </section>
    `,
  );
}

function render() {
  if (state.action) renderAction();
  else if (state.character) renderCharacter();
  else if (state.project) renderProject();
  else renderHome();
  requestAnimationFrame(() => {
    drawSkeletonPreviews();
    drawPosePreviews();
  });
}

async function loadSkeletons() {
  const data = await api("/api/skeleton-presets");
  state.skeletons = data.skeletons;
}

async function loadProjects() {
  const data = await api("/api/projects");
  state.projects = data.projects;
  state.dataRoot = data.data_root;
  state.provider = data.provider;
  render();
}

async function loadActionTemplates(projectId) {
  const data = await api(`/api/projects/${projectId}/action-templates`);
  state.actionTemplates = data.templates;
  if (!templateById(state.selectedTemplateId) && state.actionTemplates.length) {
    state.selectedTemplateId = state.actionTemplates[0].id;
  }
}

async function openProject(id) {
  state.action = null;
  state.character = null;
  state.project = await api(`/api/projects/${id}`);
  await loadActionTemplates(id);
  render();
}

async function openCharacter(id) {
  state.action = null;
  state.character = await api(`/api/projects/${state.project.id}/characters/${id}`);
  await loadActionTemplates(state.project.id);
  render();
}

async function openAction(id) {
  state.action = await api(`/api/projects/${state.project.id}/characters/${state.character.id}/actions/${id}`);
  render();
}

async function deleteProject(id, name) {
  if (!confirm(`确定删除项目「${name || id}」吗？项目里的角色、动作和 editable 文件都会被删除。`)) return;
  await api(`/api/projects/${id}`, { method: "DELETE" });
  state.project = null;
  state.character = null;
  state.action = null;
  await loadProjects();
}

async function deleteCharacter(id, name) {
  if (!state.project) return;
  if (!confirm(`确定删除角色「${name || id}」吗？这个角色的三视图、动作和 editable 文件都会被删除。`)) return;
  await api(`/api/projects/${state.project.id}/characters/${id}`, { method: "DELETE" });
  state.character = null;
  state.action = null;
  await openProject(state.project.id);
}

async function deleteAction(id, name) {
  if (!state.project || !state.character) return;
  if (!confirm(`确定删除动作「${name || id}」吗？这个动作的帧、GIF、spritesheet 和 editable 动作帧都会被删除。`)) return;
  await api(`/api/projects/${state.project.id}/characters/${state.character.id}/actions/${id}`, { method: "DELETE" });
  state.action = null;
  await openCharacter(state.character.id);
}

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    setBusy(true);
    if (form.id === "projectForm") {
      const project = await api("/api/projects", { method: "POST", body: data });
      await loadProjects();
      await openProject(project.id);
    }
    if (form.id === "characterForm") {
      const character = await api(`/api/projects/${state.project.id}/characters`, { method: "POST", body: data });
      await openProject(state.project.id);
      await openCharacter(character.id);
    }
    if (form.id === "templateForm") {
      const template = await api(`/api/projects/${state.project.id}/action-templates/generate`, {
        method: "POST",
        body: {
          ...data,
          character_id: state.character.id,
          pixel_size: state.character.pixel_size,
          loop: data.loop === "true",
        },
      });
      await loadActionTemplates(state.project.id);
      state.selectedTemplateId = template.id;
      render();
      alert(`已生成动作模板：${template.name}`);
    }
    if (form.id === "actionForm") {
      const action = await api(`/api/projects/${state.project.id}/characters/${state.character.id}/actions`, { method: "POST", body: data });
      await openCharacter(state.character.id);
      await openAction(action.id);
    }
    if (form.id === "pixelateForm") {
      const result = await api(`/api/projects/${state.project.id}/characters/${state.character.id}/pixelate`, {
        method: "POST",
        body: {
          ...data,
          grid_size: Number(data.grid_size),
          palette_limit: Number(data.palette_limit),
        },
      });
      await openCharacter(state.character.id);
      alert(`已生成 ${result.count} 张完美像素图，回退 ${result.fallback_count || 0} 张`);
    }
  } catch (error) {
    alert(error.message);
  } finally {
    setBusy(false);
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches('select[name="skeleton_id"]')) {
    document.querySelectorAll('canvas[data-skeleton-preview="select"]').forEach((canvas) => {
      canvas.dataset.skeletonId = target.value;
    });
    drawSkeletonPreviews();
  }
  if (target.matches('select[name="template_id"]')) {
    state.selectedTemplateId = target.value;
    const preview = document.querySelector("#selectedTemplatePreview");
    if (preview) {
      preview.innerHTML = selectedTemplatePreviewMarkup(templateById(target.value));
      drawPosePreviews();
    }
  }
});

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.home !== undefined) {
    state.project = null;
    state.character = null;
    state.action = null;
    await loadProjects();
  }
  if (target.dataset.backProject !== undefined) {
    await openProject(state.project.id);
  }
  if (target.dataset.backCharacter !== undefined) {
    await openCharacter(state.character.id);
  }
  if (target.dataset.deleteProject) {
    await deleteProject(target.dataset.deleteProject, target.dataset.deleteName);
    return;
  }
  if (target.dataset.deleteCharacter) {
    await deleteCharacter(target.dataset.deleteCharacter, target.dataset.deleteName);
    return;
  }
  if (target.dataset.deleteAction) {
    await deleteAction(target.dataset.deleteAction, target.dataset.deleteName);
    return;
  }
  if (target.dataset.openEditable !== undefined) {
    const result = await api(`/api/projects/${state.project.id}/characters/${state.character.id}/editable/open`, { method: "POST" });
    alert(`已打开编辑源文件夹：${result.path}`);
  }
  if (target.dataset.syncEditable !== undefined) {
    const result = await api(`/api/projects/${state.project.id}/characters/${state.character.id}/editable/sync`, {
      method: "POST",
      body: { overwrite: false },
    });
    state.character = result.character;
    render();
    alert("已同步 editable 编辑结果");
  }
  if (target.dataset.rebuildEditable !== undefined) {
    if (!confirm("这会用 raw 原始图重新生成 editable，并覆盖你手动编辑过的 PNG。确定继续吗？")) return;
    const result = await api(`/api/projects/${state.project.id}/characters/${state.character.id}/editable/sync`, {
      method: "POST",
      body: { overwrite: true },
    });
    state.character = result.character;
    render();
    alert("已从 raw 重建 editable");
  }
  if (target.dataset.openProject) await openProject(target.dataset.openProject);
  if (target.dataset.openCharacter) await openCharacter(target.dataset.openCharacter);
  if (target.dataset.openAction) await openAction(target.dataset.openAction);
});

(async function start() {
  await loadSkeletons();
  await loadProjects();
})().catch((error) => {
  app.innerHTML = `<div class="empty">${error.message}</div>`;
});
