// 后台服务（service worker）：负责把配置转换为 DNR 动态规则。
// 规则用途：在访问 OpenList 路径或网盘 CDN 时，自动切换 UA/Referer。
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

// 默认配置：扩展首次安装时写入 storage。
const defaultConfig = {
    rules: [
        {
            id: 1,
            cloudType: 'baidu',
            baseUrl: 'http://127.0.0.1:5244',
            keyword: '百度网盘',
            userAgent: 'pan.baidu.com',
            enabled: true,

            // 自定义类型使用
            customDomains: [],

            // 百度网盘预设下可覆盖的域名（新增）
            overrideDomainsEnabled: false,
            overrideDomains: []
        }
    ]
};

// 配置迁移：把旧配置补齐为新结构，避免旧字段缺失导致报错。
// --- 配置迁移：兼容你之前“覆盖升级文件”的情况 ---
function migrateConfig(config) {
    if (!config || !Array.isArray(config.rules)) return { config, changed: false };

    let changed = false;
    const newConfig = { ...config };

    // 逐条规则修复字段，保持配置向后兼容。
    newConfig.rules = newConfig.rules.map((r) => {
        const rule = { ...r };

        if (!rule.cloudType) {
            // 你目前只用百度网盘，所以旧配置默认迁移成 baidu
            rule.cloudType = 'baidu';
            changed = true;
        }
        if (!Array.isArray(rule.customDomains)) {
            rule.customDomains = [];
            changed = true;
        }

        // 新增字段补齐
        if (typeof rule.overrideDomainsEnabled !== 'boolean') {
            rule.overrideDomainsEnabled = false;
            changed = true;
        }
        if (!Array.isArray(rule.overrideDomains)) {
            rule.overrideDomains = [];
            changed = true;
        }

        return rule;
    });

    return { config: newConfig, changed };
}

// 初始化
chrome.runtime.onInstalled.addListener(async () => {
    console.log('=== OpenList UA 切换扩展已加载 ===');

    const data = await chrome.storage.local.get('config');
    let config = data.config;

    if (!config) {
        // 首次安装：写入默认配置
        config = defaultConfig;
        await chrome.storage.local.set({ config });
    } else {
        const r = migrateConfig(config);
        config = r.config;
        if (r.changed) {
            await chrome.storage.local.set({ config });
            console.log('✅ 已自动迁移旧配置');
        }
    }

    // 根据当前配置生成动态规则
    await updateRules(config.rules);
});

// 监听配置变化：Options 页面保存后立即生效。
chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local' && changes.config) {
        console.log('=== 配置已更新 ===');
        await updateRules(changes.config.newValue.rules);
    }
});

// 更新动态规则：删除旧规则并按当前配置重建。
// 规则组成：
// - 规则 1：匹配 OpenList 本地路径（用于“进入目录”的页面请求）
// - 规则 2..N：匹配 CDN 域名（用于 302 后真实资源请求）
async function updateRules(rules) {
    console.log('=== 开始更新规则 ===');

    // 先读出已有动态规则，后面统一删除。
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingRuleIds = existingRules.map(rule => rule.id);

    const newRules = [];

    rules.forEach((rule, index) => {
        if (!rule.enabled) {
            console.log(`规则 ${index + 1} 未启用，跳过`);
            return;
        }

        // URL 中的关键词需要编码，避免中文路径匹配失败。
        const encodedKeyword = encodeURIComponent(rule.keyword || '');
        // 给每条规则分配一个 ID 段，避免子规则 ID 冲突。
        const ruleId = (index + 1) * 100;

        console.log(
            `规则 ${index + 1}: 类型=${rule.cloudType} keyword="${rule.keyword}" UA="${rule.userAgent}"`
        );

        // 规则1：匹配 OpenList 本地路径（用于“进入该网盘目录”时的页面请求）
        if (rule.baseUrl && encodedKeyword) {
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
        }

        // 计算要匹配的 CDN 域名列表：
        // - 百度：允许用“覆盖域名”替代预设
        // - 自定义：直接使用自定义域名
        const preset = CLOUD_PRESETS[rule.cloudType] || CLOUD_PRESETS.custom;
        let domainsToMatch = [];

        if (rule.cloudType === 'baidu') {
            const overrideOn = rule.overrideDomainsEnabled === true;
            const overrideList = Array.isArray(rule.overrideDomains) ? rule.overrideDomains : [];
            domainsToMatch = (overrideOn && overrideList.length > 0) ? overrideList : preset.domains;
        } else if (rule.cloudType === 'custom') {
            domainsToMatch = Array.isArray(rule.customDomains) ? rule.customDomains : [];
        } else {
            domainsToMatch = preset.domains || [];
        }

        // 规则2-N：匹配网盘 CDN 域名（用于 302 后真实请求）
        domainsToMatch.forEach((domain, idx) => {
            const d = (domain || '').trim();
            if (!d) return;

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
                    urlFilter: d,
                    resourceTypes: ['xmlhttprequest', 'media', 'other']
                }
            });
        });
    });

    try {
        // 先删后加，避免残留旧规则。
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRuleIds,
            addRules: newRules
        });
        console.log(`✅ 成功应用 ${newRules.length} 条规则`);
    } catch (error) {
        console.error('❌ 更新规则失败:', error);
    }
}

// 根据网盘类型获取合适的 Referer（部分 CDN 会校验 Referer）。
function getReferer(cloudType) {
    const referers = {
        baidu: 'https://pan.baidu.com/',
        custom: ''
    };
    return referers[cloudType] || '';
}
