// 网盘预设配置
const CLOUD_PRESETS = {
    baidu: {
        name: '百度网盘',
        defaultUA: 'pan.baidu.com',
        domains: [
            '*://*.baidupcs.com/*',
            '*://*.pcs.baidu.com/*',
            '*://d.pcs.baidu.com/*',
            '*://nj.baidupcs.com/*',
            '*://pan.baidu.com/*'
        ]
    },
    custom: {
        name: '自定义',
        defaultUA: '',
        domains: []
    }
};

let config = { rules: [] };

// 加载配置
async function loadConfig() {
    const data = await chrome.storage.local.get('config');
    config = data.config || { rules: [] };

    // 兼容旧配置：补齐字段，避免“覆盖升级文件”后页面渲染异常
    config.rules = (config.rules || []).map(r => ({
        id: r.id ?? 1,
        cloudType: r.cloudType ?? 'baidu',
        baseUrl: r.baseUrl ?? 'http://127.0.0.1:5244',
        keyword: r.keyword ?? '',
        userAgent: r.userAgent ?? 'pan.baidu.com',
        enabled: (typeof r.enabled === 'boolean') ? r.enabled : true,
        customDomains: Array.isArray(r.customDomains) ? r.customDomains : [],
        overrideDomainsEnabled: (typeof r.overrideDomainsEnabled === 'boolean') ? r.overrideDomainsEnabled : false,
        overrideDomains: Array.isArray(r.overrideDomains) ? r.overrideDomains : []
    }));

    renderRules();
}

// 渲染规则列表
function renderRules() {
    const container = document.getElementById('rules-container');
    container.innerHTML = '';

    config.rules.forEach((rule, index) => {
        const preset = CLOUD_PRESETS[rule.cloudType] || CLOUD_PRESETS.custom;

        const isCustomType = rule.cloudType === 'custom';
        const isBaiduType = rule.cloudType === 'baidu';

        const customDomainsText = (rule.customDomains || []).join('\n');

        const presetDomainsText = CLOUD_PRESETS.baidu.domains.join('\n');
        const overrideEnabled = rule.overrideDomainsEnabled === true;
        const overrideDomainsText = (rule.overrideDomains || []).join('\n');

        const ruleDiv = document.createElement('div');
        ruleDiv.className = `rule-item ${rule.enabled ? '' : 'disabled'}`;

        ruleDiv.innerHTML = `
      <div class="rule-header">
        <h3 class="rule-title">规则 ${index + 1}</h3>
        <button class="delete" data-index="${index}">🗑️ 删除</button>
      </div>

      <label>网盘类型:</label>
      <select class="cloud-type" data-index="${index}">
        <option value="baidu" ${isBaiduType ? 'selected' : ''}>百度网盘</option>
        <option value="custom" ${isCustomType ? 'selected' : ''}>自定义</option>
      </select>

      <label>OpenList 地址:</label>
      <input type="text" class="base-url" data-index="${index}" value="${escapeHtml(rule.baseUrl)}"
             placeholder="例如: http://127.0.0.1:5244">

      <label>路径关键词 (挂载点名称):</label>
      <input type="text" class="keyword" data-index="${index}" value="${escapeHtml(rule.keyword)}"
             placeholder="例如: 百度网盘 或 度盘">

      <label>User-Agent:</label>
      <input type="text" class="user-agent" data-index="${index}" value="${escapeHtml(rule.userAgent)}"
             placeholder="${escapeHtml(preset.defaultUA || '自定义 UA')}">

      ${isBaiduType ? `
        <label>
          <input type="checkbox" class="override-enabled" data-index="${index}" ${overrideEnabled ? 'checked' : ''}>
          允许自定义百度 CDN 域名（勾选后下方编辑内容才会生效）
        </label>

        <label>百度 CDN 域名（可编辑）：<span class="hint">每行一个，支持通配符 *</span></label>
        <textarea class="override-domains" data-index="${index}" ${overrideEnabled ? '' : 'disabled'}
          placeholder="${escapeHtml(presetDomainsText)}">${escapeHtml(overrideDomainsText)}</textarea>

        <div class="inline-actions">
          <button type="button" class="secondary fill-preset" data-index="${index}">把“预设”填入编辑框</button>
          <button type="button" class="secondary reset-override" data-index="${index}">恢复为预设（并关闭自定义）</button>
        </div>

        <div class="preset-info">当前内置预设（只读展示）：\n${escapeHtml(presetDomainsText)}</div>
      ` : ''}

      ${isCustomType ? `
        <label>自定义 CDN 域名：<span class="hint">每行一个，支持通配符 *</span></label>
        <textarea class="custom-domains" data-index="${index}"
          placeholder="例如：\n*://*.example.com/*\n*://cdn.example.com/*">${escapeHtml(customDomainsText)}</textarea>
      ` : ''}

      <div class="checkbox-group">
        <label>
          <input type="checkbox" class="enabled" data-index="${index}" ${rule.enabled ? 'checked' : ''}>
          启用此规则
        </label>
      </div>
    `;

        container.appendChild(ruleDiv);
    });

    bindEvents();
}

// 绑定事件
function bindEvents() {
    // 网盘类型切换
    document.querySelectorAll('.cloud-type').forEach(select => {
        select.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            const cloudType = e.target.value;

            config.rules[index].cloudType = cloudType;

            // 切换到百度网盘：自动填充推荐 UA（如果用户之前没自定义 UA）
            if (cloudType === 'baidu') {
                if (!config.rules[index].userAgent || config.rules[index].userAgent.trim() === '') {
                    config.rules[index].userAgent = CLOUD_PRESETS.baidu.defaultUA;
                }
            }

            renderRules();
        });
    });

    // 删除
    document.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            config.rules.splice(index, 1);
            renderRules();
        });
    });

    // baseUrl / keyword / UA
    document.querySelectorAll('.base-url').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            config.rules[index].baseUrl = e.target.value;
        });
    });
    document.querySelectorAll('.keyword').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            config.rules[index].keyword = e.target.value;
        });
    });
    document.querySelectorAll('.user-agent').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            config.rules[index].userAgent = e.target.value;
        });
    });

    // 自定义类型：域名
    document.querySelectorAll('.custom-domains').forEach(textarea => {
        textarea.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            config.rules[index].customDomains = toLines(e.target.value);
        });
    });

    // 百度类型：是否启用覆盖
    document.querySelectorAll('.override-enabled').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            config.rules[index].overrideDomainsEnabled = e.target.checked;
            renderRules();
        });
    });

    // 百度类型：覆盖域名编辑
    document.querySelectorAll('.override-domains').forEach(textarea => {
        textarea.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            config.rules[index].overrideDomains = toLines(e.target.value);
        });
    });

    // 百度类型：把预设填入编辑框
    document.querySelectorAll('.fill-preset').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            config.rules[index].overrideDomainsEnabled = true;
            config.rules[index].overrideDomains = [...CLOUD_PRESETS.baidu.domains];
            renderRules();
        });
    });

    // 百度类型：恢复预设（并关闭自定义）
    document.querySelectorAll('.reset-override').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            config.rules[index].overrideDomainsEnabled = false;
            config.rules[index].overrideDomains = [];
            renderRules();
        });
    });

    // 启用/禁用
    document.querySelectorAll('.enabled').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            config.rules[index].enabled = e.target.checked;
            renderRules();
        });
    });
}

// 添加新规则
document.getElementById('add-rule').addEventListener('click', () => {
    const newId = config.rules.length > 0 ? Math.max(...config.rules.map(r => r.id || 0)) + 1 : 1;
    config.rules.push({
        id: newId,
        cloudType: 'baidu',
        baseUrl: 'http://127.0.0.1:5244',
        keyword: '',
        userAgent: 'pan.baidu.com',
        enabled: true,
        customDomains: [],
        overrideDomainsEnabled: false,
        overrideDomains: []
    });
    renderRules();
});

// 保存配置
document.getElementById('save').addEventListener('click', async () => {
    await chrome.storage.local.set({ config });
    showStatus('✅ 配置已保存！规则将立即生效');
});

// 恢复默认
document.getElementById('reset').addEventListener('click', async () => {
    if (confirm('确定要恢复默认配置吗？当前配置将被清空！')) {
        config = {
            rules: [
                {
                    id: 1,
                    cloudType: 'baidu',
                    baseUrl: 'http://127.0.0.1:5244',
                    keyword: '百度网盘',
                    userAgent: 'pan.baidu.com',
                    enabled: true,
                    customDomains: [],
                    overrideDomainsEnabled: false,
                    overrideDomains: []
                }
            ]
        };
        await chrome.storage.local.set({ config });
        renderRules();
        showStatus('✅ 已恢复默认配置');
    }
});

// 显示状态提示
function showStatus(message) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.style.display = 'block';
    setTimeout(() => { status.style.display = 'none'; }, 2500);
}

// 工具：把多行文本转数组
function toLines(text) {
    return String(text)
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
}

// 工具：基础转义，避免把用户输入破坏 HTML
function escapeHtml(s) {
    return String(s ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

// 初始化
loadConfig();
