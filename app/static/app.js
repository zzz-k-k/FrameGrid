const state = {
  projects: [],
  project: null,
  character: null,
  action: null,
  dataRoot: "",
  provider: "",
  busy: false,
};

const app = document.querySelector("#app");

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
      <button class="primary" data-open-project="${project.id}">进入项目</button>
    </article>
  `;
}

function characterCard(character) {
  return `
    <article class="card">
      <div class="card-title">
        <h3>${character.name}</h3>
        <span class="badge">三视图</span>
      </div>
      <div class="thumb-row">
        ${imageTile(character.views?.front, "正")}
        ${imageTile(character.views?.side, "侧")}
      </div>
      <div class="meta">${character.prompt || "无提示词"}</div>
      <button class="primary" data-open-character="${character.id}">进入角色</button>
    </article>
  `;
}

function actionCard(action) {
  return `
    <article class="card">
      <div class="card-title">
        <h3>${action.name}</h3>
        <span class="badge">${action.frame_count} 帧</span>
      </div>
      <div class="image-tile">
        <img class="action-preview" src="${action.preview}" alt="${action.name}" />
      </div>
      <div class="meta">${action.prompt || "无动作提示词"}<br />${action.fps} FPS</div>
      <button class="primary" data-open-action="${action.id}">查看动作</button>
    </article>
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
          <p>创建项目后，角色和动作都会保存在独立项目文件夹里。</p>
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
      <section class="panel">
        <h3>创建角色</h3>
        <form class="form" id="characterForm">
          <label>角色名称
            <input name="name" value="新角色" />
          </label>
          <label>角色提示词
            <textarea name="prompt">一个穿短斗篷的像素风冒险者，清晰轮廓，适合 2D 游戏动画</textarea>
          </label>
          <button class="primary" ${state.busy ? "disabled" : ""}>生成三视图</button>
          <div class="status">${state.busy ? "正在调用 Codex 生成正视图、侧视图、顶视图，完成后会自动转成透明背景..." : "生成结果会进入角色 views 文件夹，最终 PNG 是透明背景。"}</div>
        </form>
      </section>
    `,
    `
      <div class="topbar">
        <div>
          <h2>${project.name}</h2>
          <p>先创建角色三视图，再进入角色生成动作。</p>
        </div>
      </div>
      ${project.characters.length ? `<section class="grid">${project.characters.map(characterCard).join("")}</section>` : `<div class="empty">这个项目还没有角色。</div>`}
    `,
  );
}

function renderCharacter() {
  const character = state.character;
  layout(
    `
      <button class="ghost" data-back-project>返回项目</button>
      <section class="side-section">
        <h2>角色目录</h2>
        <div class="crumb">${character.path}</div>
      </section>
      <section class="panel">
        <h3>生成动作</h3>
        <form class="form" id="actionForm">
          <label>动作名称
            <input name="name" value="walk" />
          </label>
          <label>动作提示词
            <textarea name="prompt">自然的行走循环，保持角色身份和服装一致</textarea>
          </label>
          <div class="split">
            <label>帧数
              <input name="frame_count" type="number" min="2" max="12" value="6" />
            </label>
            <label>FPS
              <input name="fps" type="number" min="1" max="24" value="8" />
            </label>
          </div>
          <button class="primary" ${state.busy ? "disabled" : ""}>生成动作</button>
          <div class="status">${state.busy ? "正在逐帧调用 Codex 生图，并自动去除背景..." : "动作会根据三视图参考逐帧生成透明背景 PNG。"}</div>
        </form>
      </section>
      <section class="panel">
        <h3>像素规整</h3>
        <form class="form" id="pixelForm">
          <div class="split">
            <label>网格
              <select name="grid_size">
                <option>32</option>
                <option selected>64</option>
                <option>96</option>
                <option>128</option>
              </select>
            </label>
            <label>颜色数
              <select name="palette_limit">
                <option>16</option>
                <option selected>24</option>
                <option>32</option>
                <option>48</option>
              </select>
            </label>
          </div>
          <button ${state.busy ? "disabled" : ""}>规整三视图和动作帧</button>
          <div class="status" id="pixelStatus">输出到角色 pixelated 文件夹。</div>
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
          <h3>生成说明</h3>
          <div class="meta">当前 Provider：${character.provider}<br />图片由本地 Codex 子进程调用 imagegen skill 生成，并自动处理为透明背景。</div>
        </section>
      </div>
      <div style="height: 18px"></div>
      ${character.actions.length ? `<section class="grid">${character.actions.map(actionCard).join("")}</section>` : `<div class="empty">还没有动作，先生成一套 walk / idle / attack。</div>`}
    `,
  );
}

function renderAction() {
  const action = state.action;
  layout(
    `
      <button class="ghost" data-back-character>返回角色</button>
      <section class="side-section">
        <h2>动作信息</h2>
        <div class="crumb">${action.path}</div>
        <div class="meta">${action.frame_count} 帧，${action.fps} FPS</div>
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
}

async function loadProjects() {
  const data = await api("/api/projects");
  state.projects = data.projects;
  state.dataRoot = data.data_root;
  state.provider = data.provider;
  render();
}

async function openProject(id) {
  state.action = null;
  state.character = null;
  state.project = await api(`/api/projects/${id}`);
  render();
}

async function openCharacter(id) {
  state.action = null;
  state.character = await api(`/api/projects/${state.project.id}/characters/${id}`);
  render();
}

async function openAction(id) {
  state.action = await api(`/api/projects/${state.project.id}/characters/${state.character.id}/actions/${id}`);
  render();
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
    if (form.id === "actionForm") {
      const action = await api(`/api/projects/${state.project.id}/characters/${state.character.id}/actions`, { method: "POST", body: data });
      await openCharacter(state.character.id);
      await openAction(action.id);
    }
    if (form.id === "pixelForm") {
      const result = await api(`/api/projects/${state.project.id}/characters/${state.character.id}/pixelate`, { method: "POST", body: data });
      await openCharacter(state.character.id);
      setTimeout(() => {
        const status = document.querySelector("#pixelStatus");
        if (status) status.textContent = `已规整 ${result.count} 张图片。`;
      }, 0);
    }
  } catch (error) {
    alert(error.message);
  } finally {
    setBusy(false);
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
  if (target.dataset.openProject) await openProject(target.dataset.openProject);
  if (target.dataset.openCharacter) await openCharacter(target.dataset.openCharacter);
  if (target.dataset.openAction) await openAction(target.dataset.openAction);
});

loadProjects().catch((error) => {
  app.innerHTML = `<div class="empty">${error.message}</div>`;
});
