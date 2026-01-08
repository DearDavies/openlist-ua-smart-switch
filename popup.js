// 弹窗脚本：点击按钮后打开扩展设置页。
console.log('Popup script loaded');

document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded');

    const button = document.getElementById('open-options');

    if (button) {
        console.log('Button found');

        button.addEventListener('click', function () {
            console.log('Button clicked!');

            // 方法1：使用 openOptionsPage（推荐，Chrome 会处理打开逻辑）
            if (chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                // 方法2：如果方法1不支持，手动打开 options.html
                window.open(chrome.runtime.getURL('options.html'));
            }
        });
    } else {
        console.error('Button not found!');
    }
});
