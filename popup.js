// popup.js
console.log('Popup script loaded');

document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded');

    const button = document.getElementById('open-options');

    if (button) {
        console.log('Button found');

        button.addEventListener('click', function () {
            console.log('Button clicked!');

            // 方法1：使用 openOptionsPage
            if (chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                // 方法2：如果方法1不支持，手动打开
                window.open(chrome.runtime.getURL('options.html'));
            }
        });
    } else {
        console.error('Button not found!');
    }
});
