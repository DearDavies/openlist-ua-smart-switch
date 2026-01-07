// 网盘预设配置
const CLOUD_PRESETS = {
    'baidu': {
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
    'custom': {
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
    renderRules();
}

// 渲染规则列表
function renderRules() {
    const container = document.getElementById('rules-container');
    container.innerHTML = '';

    config.rules.forEach((rule, index) => {
        const ruleDiv = document.createElement('div');
        ruleDiv.className = `rule-item ${rule.enabled ? '' : 'disabled'}`;

        // 获取当前规则的网盘类型预设
        const preset = CLOUD_PRESETS[rule.cloudType] || CLOUD_PRESETS['custom'];
        const customDomainsText = (rule.customDomains || []).join('\n');
        const isCustomType = rule.cloudType === 'custom';

        ruleDiv.innerHTML = `
      <div class="rule-header">
        <h3 class="rule-title">规则 ${index + 1}</h3>
        <button class="delete" data-index="${index}">🗑️ 删除</button>
      </div>
      
      <label>网盘类型:</label>
      <select class="cloud-type" data-index="${index}">
        <option value="baidu" ${rule.cloudType === 'baidu' ? 'selected' : ''}>百度网盘</option>
        <option value="custom" ${rule.cloudType === 'custom' ? 'selected' : ''}>自定义</option>
      </select>
      
      ${!isCustomType ? `
      <div class="preset-info">
        📦 已预设 ${preset.domains.length} 个百度 CDN 域名：${preset.domains.slice(0, 2).join(', ')}${preset.domains.length > 2 ? ' 等' : ''}
      </div>
      ` : ''}
      
      <label>OpenList 地址:</label>
      <input type="text" class="base-url" data-index="${index}" value="${rule.baseUrl}" 
             placeholder="例如: http://127.0.0.1:5244">
      
      <label>路径关键词 (挂载点名称):</label>
      <input type="text" class="keyword" data-index="${index}" value="${rule.keyword}" 
             placeholder="例如: 百度网盘">
      
      <label>User-Agent:</label>
      <input type="text" class="user-agent" data-index="${index}" value="${rule.userAgent}" 
             placeholder="${preset.defaultUA || '自定义 UA'}">
      
      <div class="custom-domains-section ${isCustomType ? 'show' : ''}" data-index="${index}">
        <label>
          自定义 CDN 域名:
          <span class="hint">每行一个，支持通配符 *，例如 *://*.example.com/*</span>
        </label>
        <textarea class="custom-domains" data-index="${index}" 
                  placeholder="例如：&#10;*://*.115.com/*&#10;*://*.quark.cn/*">${customDomainsText}</textarea>
      </div>
      
      <div class="checkbox-group">
        <label>
          <input type="checkbox" class="enabled" data-index="${index}" ${rule.enabled ? 'checked' : ''}>
          启用此规则
        </label>
      </div>
    `;
        container.appendChild(ruleDiv);
    });

    // 绑定事件
    bindEvents();
}

// 绑定事件
function bindEvents() {
    // 网盘类型选择
    document.querySelectorAll('.cloud-type').forEach(select => {
        select.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            const cloudType = e.target.value;
            config.rules[index].cloudType = cloudType;

            // 自动填充推荐的 UA
            const preset = CLOUD_PRESETS[cloudType];
            if (preset && preset.defaultUA) {
                config.rules[index].userAgent = preset.defaultUA;
            }

            renderRules();
        });
    });

    // 删除按钮
    document.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            config.rules.splice(index, 1);
            renderRules();
        });
    });

    // 其他输入框
    document.querySelectorAll('.base-url').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            config.rules[index].baseUrl = e.target.value;
        });
    });

    document.querySelectorAll('.keyword').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            config.rules[index].keyword = e.target.value;
        });
    });

    document.querySelectorAll('.user-agent').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            config.rules[index].userAgent = e.target.value;
        });
    });

    document.querySelectorAll('.custom-domains').forEach(textarea => {
        textarea.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            const domains = e.target.value.split('\n').map(d => d.trim()).filter(d => d !== '');
            config.rules[index].customDomains = domains;
        });
    });

    document.querySelectorAll('.enabled').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            config.rules[index].enabled = e.target.checked;
            renderRules();
        });
    });
}

// 添加新规则
document.getElementById('add-rule').addEventListener('click', () => {
    const newId = config.rules.length > 0 ? Math.max(...config.rules.map(r => r.id)) + 1 : 1;
    config.rules.push({
        id: newId,
        cloudType: 'baidu',
        baseUrl: 'http://127.0.0.1:5244',
        keyword: '',
        userAgent: 'pan.baidu.com',
        customDomains: [],
        enabled: true
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
                    customDomains: [],
                    enabled: true
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
    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
}

// 初始化
loadConfig();
