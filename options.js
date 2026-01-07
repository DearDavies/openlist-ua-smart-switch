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
        ruleDiv.innerHTML = `
      <div class="rule-header">
        <h3 class="rule-title">规则 ${index + 1}</h3>
        <button class="delete" data-index="${index}">🗑️ 删除</button>
      </div>
      
      <label>基础网址 (Base URL):</label>
      <input type="text" class="base-url" data-index="${index}" value="${rule.baseUrl}" 
             placeholder="例如: http://127.0.0.1:5244">
      
      <label>路径关键词 (Keyword):</label>
      <input type="text" class="keyword" data-index="${index}" value="${rule.keyword}" 
             placeholder="例如: 百度网盘 或 度盘">
      
      <label>User-Agent:</label>
      <input type="text" class="user-agent" data-index="${index}" value="${rule.userAgent}" 
             placeholder="例如: pan.baidu.com">
      
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
    // 删除按钮
    document.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            config.rules.splice(index, 1);
            renderRules();
        });
    });

    // 输入框变化
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
        baseUrl: 'http://127.0.0.1:5244',
        keyword: '',
        userAgent: 'pan.baidu.com',
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
                    baseUrl: 'http://127.0.0.1:5244',
                    keyword: '百度网盘',
                    userAgent: 'pan.baidu.com',
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
