// 默认配置
const defaultConfig = {
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

// 初始化
chrome.runtime.onInstalled.addListener(async () => {
    console.log('=== 扩展安装/更新 ===');
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
        if (!rule.enabled) return;

        const encodedKeyword = encodeURIComponent(rule.keyword);
        const ruleId = (index + 1) * 10;

        console.log(`规则 ${index + 1}: 关键词="${rule.keyword}" UA="${rule.userAgent}"`);

        // 规则1：匹配 OpenList 页面本身
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

        // 规则2-6：匹配百度网盘的各个 CDN 域名（这是关键！）
        const baiduDomains = [
            '*://*.baidupcs.com/*',      // 主要的 CDN 域名
            '*://*.pcs.baidu.com/*',     // 另一个 CDN
            '*://d.pcs.baidu.com/*',     // 下载域名
            '*://nj.baidupcs.com/*',     // 南京节点
            '*://pan.baidu.com/*'        // 网盘主站
        ];

        baiduDomains.forEach((domain, idx) => {
            newRules.push({
                id: ruleId + 100 + idx,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [
                        { header: 'user-agent', operation: 'set', value: rule.userAgent },
                        { header: 'referer', operation: 'set', value: 'https://pan.baidu.com/' }
                    ]
                },
                condition: {
                    urlFilter: domain,
                    resourceTypes: ['xmlhttprequest', 'media', 'other']
                }
            });
            console.log(`  添加百度 CDN 规则 ${idx + 1}: ${domain}`);
        });
    });

    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRuleIds,
            addRules: newRules
        });

        console.log(`✅ 成功应用 ${newRules.length} 条规则`);

        const appliedRules = await chrome.declarativeNetRequest.getDynamicRules();
        console.log('✅ 当前生效规则数:', appliedRules.length);
        appliedRules.forEach(r => {
            console.log(`   规则 ${r.id}: ${r.condition.urlFilter}`);
        });
    } catch (error) {
        console.error('❌ 失败:', error);
    }
}
