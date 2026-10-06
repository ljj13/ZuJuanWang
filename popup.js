// 获取DOM元素
const studentRadio = document.getElementById('student');
const teacherRadio = document.getElementById('teacher');
const extractBtn = document.getElementById('extract-btn');
const saveAsWordBtn = document.getElementById('save-as-word-btn');
const saveAsPdfBtn = document.getElementById('save-as-pdf-btn');
const exportRow = document.querySelector('.export-row');
const verifyResult = document.getElementById('verify-result');
const analysisLocationGroup = document.getElementById('analysis-location');
const versionHint = document.getElementById('version-hint');

// 获取当前选中的版本
function getSelectedVersion() {
  return document.querySelector('input[name="version"]:checked').value;
}

// 获取当前选中的解析位置
function getSelectedAnalysisLocation() {
  return document.querySelector('input[name="analysisLocation"]:checked').value;
}

// 获取当前选中的导出纸张
function getSelectedPaperSize() {
  const selected = document.querySelector('input[name="paperSize"]:checked');
  return selected ? selected.value : 'a4';
}

// 显示提示结果
function showVerifyResult(message, type) {
  verifyResult.textContent = message;
  verifyResult.className = `verify-result verify-${type}`;
  verifyResult.style.display = 'block';

  // 3秒后隐藏结果
  setTimeout(() => {
    verifyResult.style.display = 'none';
  }, 3000);
}

// 防止提取试卷按钮点击事件重复触发的标志
let isProcessingExtract = false;

// 监听提取试卷按钮点击事件
extractBtn.addEventListener('click', async () => {
  // 如果已经在处理中，直接返回，防止重复触发
  if (isProcessingExtract) {
    return;
  }

  try {
    // 设置处理中标志
    isProcessingExtract = true;

    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 获取选中的版本
    const version = getSelectedVersion();

    // 获取解析位置
    let analysisLocation = 'after-question'; // 默认值
    if (version === 'teacher') {
      analysisLocation = getSelectedAnalysisLocation();
    }

    // 向background.js发送消息，执行差异化处理和提取试卷功能
    // 用 Promise 等待后台响应，保证防重复标志在请求结束前有效
    await new Promise(resolve => {
      chrome.runtime.sendMessage({
        action: 'extractPaper',
        tabId: tab.id,
        version: version,
        analysisLocation: analysisLocation,
        paperSize: getSelectedPaperSize()
      }, resolve);
    });
  } catch (error) {
    console.error('提取试卷失败:', error);
    showVerifyResult('提取试卷失败，请稍后重试。', 'error');
  } finally {
    // 重置处理中标志
    isProcessingExtract = false;
  }
});

// 获取插件版本号
function getExtensionVersion() {
  const manifest = chrome.runtime.getManifest();
  return manifest.version || '1.0.0';
}

// 检查当前页面是否为提取试卷后的新页面
async function checkIfExtractedPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return false;

    // 检查是否为chrome://或edge:// URL，如果是则直接返回false
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://'))) {
      return false;
    }

    // 执行脚本检查页面特征
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // 检查页面是否有提取试卷后的特征
        const hasTitleTxt = document.querySelector('.title-txt') !== null;
        const hasContentEditable = document.querySelector('[contenteditable="true"]') !== null;
        const title = document.title || '';
        const hasVersionSuffix = title.includes('-学生版') || title.includes('-教师版');
        const isAboutBlank = window.location.href === 'about:blank';
        const hasPaperTitle = document.querySelector('.paper-title') !== null;
        const hasPuiMainTitle = document.getElementById('pui_maintitle') !== null;

        // 如果是空白页面且有标题后缀，很可能是提取后的页面
        if (isAboutBlank && hasVersionSuffix) {
          return true;
        }

        // 或者如果有title-txt元素且有可编辑属性，也可能是提取后的页面
        if (hasTitleTxt && hasContentEditable) {
          return true;
        }

        // 或者如果有paper-title元素且有可编辑属性，也可能是提取后的页面
        if (hasPaperTitle && hasContentEditable) {
          return true;
        }

        // 或者如果有pui_maintitle元素且有可编辑属性，也可能是提取后的页面
        if (hasPuiMainTitle && hasContentEditable) {
          return true;
        }

        // 或者如果标题包含版本后缀且页面有可编辑属性，也可能是提取后的页面
        if (hasVersionSuffix && hasContentEditable) {
          return true;
        }

        return false;
      }
    });

    return result && result[0] && result[0].result;
  } catch (error) {
    console.error('检查页面类型失败:', error);
    return false;
  }
}

// 更新保存为Word和PDF按钮的显示状态
async function updateSaveAsWordButton() {
  // 添加重试机制，确保页面完全加载后再检查
  let retryCount = 0;
  const maxRetries = 5;
  const retryDelay = 300; // 毫秒

  async function checkWithRetry() {
    retryCount++;
    const isExtractedPage = await checkIfExtractedPage();

    if (isExtractedPage || retryCount >= maxRetries) {
      if (isExtractedPage) {
        exportRow.style.display = 'flex';
        saveAsWordBtn.style.display = 'block';
        saveAsPdfBtn.style.display = 'block';
        console.log('当前页面是提取试卷后的新页面，显示Word和PDF按钮');
      } else {
        exportRow.style.display = 'none';
        saveAsWordBtn.style.display = 'none';
        saveAsPdfBtn.style.display = 'none';
        console.log('当前页面不是提取试卷后的新页面，隐藏Word和PDF按钮');
      }
      return;
    }

    // 延迟后重试
    setTimeout(checkWithRetry, retryDelay);
  }

  // 开始检查
  checkWithRetry();
}

// 初始加载时的处理
window.addEventListener('DOMContentLoaded', async () => {
  // 显示插件版本号
  const version = getExtensionVersion();
  const extensionVersionElement = document.getElementById('extension-version');
  if (extensionVersionElement) {
    extensionVersionElement.textContent = version;
  }

  // 默认选择学生版
  studentRadio.checked = true;

  // 添加版本选择监听器
  studentRadio.addEventListener('change', function() {
    if (this.checked) {
      analysisLocationGroup.style.display = 'none';
      versionHint.textContent = '学生版不含解析，教师版含解析';
    }
  });

  teacherRadio.addEventListener('change', function() {
    if (this.checked) {
      analysisLocationGroup.style.display = 'block';
      versionHint.textContent = '解析默认显示在题目下方';
    }
  });

  // 更新保存为Word和PDF按钮的显示状态
  await updateSaveAsWordButton();

  // 监听标签页激活事件，以便在切换标签页时更新按钮状态
  chrome.tabs.onActivated.addListener(() => {
    updateSaveAsWordButton();
  });

  // 监听标签页更新事件，以便在页面加载过程中更新按钮状态
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // 当标签页状态变为complete时，更新按钮状态
    if (changeInfo.status === 'complete' && tab.active) {
      updateSaveAsWordButton();
    }
    // 当标签页标题更新时，也尝试更新按钮状态，因为新页面的标题会包含版本后缀
    if (changeInfo.title && tab.active) {
      updateSaveAsWordButton();
    }
  });

  // 接收background.js的提示消息（如未找到试卷内容元素）
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'networkStatus') {
      showVerifyResult(message.message, 'error');
    }
  });
});

// 监听保存为Word按钮点击事件
saveAsWordBtn.addEventListener('click', async () => {
  const originalText = saveAsWordBtn.textContent;
  try {
    saveAsWordBtn.disabled = true;
    saveAsWordBtn.textContent = '正在导出…';

    // 向background.js发送消息（文件由后台注入脚本在页面内直接触发下载）
    const response = await chrome.runtime.sendMessage({
      action: 'convertPageToWord',
      paperSize: getSelectedPaperSize()
    });

    if (response && response.success) {
      showVerifyResult('转换成功！Word文档已保存。', 'success');
    } else {
      showVerifyResult(`转换失败: ${(response && response.error) || '后台未响应，请重试'}`, 'error');
    }
  } catch (error) {
    console.error('保存为Word失败:', error);
    showVerifyResult(`转换失败: ${error.message}`, 'error');
  } finally {
    saveAsWordBtn.disabled = false;
    saveAsWordBtn.textContent = originalText;
  }
});

// 监听PDF按钮点击事件
saveAsPdfBtn.addEventListener('click', async () => {
  try {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      showVerifyResult('无法获取当前标签页', 'error');
      return;
    }

    // 向当前标签页发送打印命令
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // 弹出打印框
        window.print();
      }
    });

    showVerifyResult('打印框已弹出，请选择PDF选项保存', 'success');
  } catch (error) {
    console.error('打开打印框失败:', error);
    showVerifyResult(`打开打印框失败: ${error.message}`, 'error');
  }
});
