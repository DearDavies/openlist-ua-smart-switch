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

// 默认配置
const defaultConfig = {
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

// 初始化
chrome.runtime.onInstalled.addListener(async () => {
    console.log('=== OpenList UA 切换扩展已加载 ===');
    const { config } = await chrome.storage.local.get('config');
    if (!config) {
        await chrome.storage.local.set({ config: defaultConfig });
        await updateRules(defaultConfig.rules);
    } else {
        await updateRules(config.rules);
    }
});

// 监听配置变化
chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local' && changes.config) {
        console.log('=== 配置已更新 ===');
        await updateRules(changes.config.newValue.rules);
    }
});

// 更新动态规则
async function updateRules(rules) {
    console.log('=== 开始更新规则 ===');

    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingRuleIds = existingRules.map(rule => rule.id);

    const newRules = [];

    rules.forEach((rule, index) => {
        if (!rule.enabled) {
            console.log(`规则 ${index + 1} 未启用，跳过`);
            return;
        }

        const encodedKeyword = encodeURIComponent(rule.keyword);
        const ruleId = (index + 1) * 100;

        console.log(`规则 ${index + 1}: 类型=${rule.cloudType} 关键词="${rule.keyword}" UA="${rule.userAgent}"`);

        // 规则1：匹配 OpenList 本地路径（用于页面访问）
        newRules.push({
            id: ruleId,
            priority: 1,
            action: {
                type: 'modifyHeaders',
                requestHeaders: [
                    { header: 'user-agent', operation: 'set', value: rule.userAgent }
                ]
            },
            condition: {
                urlFilter: `${rule.baseUrl}/*${encodedKeyword}*`,
                resourceTypes: ['main_frame', 'sub_frame']
            }
        });
        console.log(`  ✓ 添加本地路径规则: ${rule.baseUrl}/*${encodedKeyword}*`);

        // 获取该网盘类型的预设域名
        const preset = CLOUD_PRESETS[rule.cloudType] || CLOUD_PRESETS['custom'];
        const domainsToMatch = [...preset.domains];

        // 如果是自定义类型，使用用户配置的域名
        if (rule.cloudType === 'custom' && rule.customDomains && rule.customDomains.length > 0) {
            domainsToMatch.push(...rule.customDomains);
        }

        // 规则2-N：匹配网盘 CDN 域名（用于实际文件请求）
        domainsToMatch.forEach((domain, idx) => {
            if (!domain || domain.trim() === '') return;

            newRules.push({
                id: ruleId + idx + 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        { header: 'user-agent', operation: 'set', value: rule.userAgent },
                        { header: 'referer', operation: 'set', value: getReferer(rule.cloudType) }
                    ]
                },
                condition: {
                    urlFilter: domain.trim(),
                    resourceTypes: ['xmlhttprequest', 'media', 'other']
                }
            });
            console.log(`  ✓ 添加 CDN 域名规则: ${domain.trim()}`);
        });
    });

    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRuleIds,
            addRules: newRules
        });

        console.log(`✅ 成功应用 ${newRules.length} 条规则`);
    } catch (error) {
        console.error('❌ 失败:', error);
    }
}

// 根据网盘类型获取合适的 Referer
function getReferer(cloudType) {
    const referers = {
        'baidu': 'https://pan.baidu.com/',
        'custom': ''
    };
    return referers[cloudType] || '';
}
