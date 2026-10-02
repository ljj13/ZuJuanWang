// 获取DOM元素
const studentRadio = document.getElementById('student');
const teacherRadio = document.getElementById('teacher');
const extractBtn = document.getElementById('extract-btn');
const saveAsWordBtn = document.getElementById('save-as-word-btn');
const saveAsPdfBtn = document.getElementById('save-as-pdf-btn');
const extensionIdElement = document.getElementById('extension-id');
const extensionStatusElement = document.getElementById('extension-status');
const doomsdayTimeElement = document.getElementById('doomsday-time');
const keyInput = document.getElementById('key-input');
const saveBtn = document.getElementById('save-btn');
const modifyBtn = document.getElementById('modify-btn');
const contactSupportBtn = document.getElementById('contact-support-btn');
const verifyResult = document.getElementById('verify-result');
const analysisLocationGroup = document.getElementById('analysis-location');
const analysisAfterQuestionRadio = document.getElementById('analysis-after-question');
const analysisAtEndRadio = document.getElementById('analysis-at-end');
const passwordInput = document.getElementById('password-input');
const activateByPasswordBtn = document.getElementById('activate-by-password-btn');

// 插件ID
let extensionId = '';

// API配置
const API_CONFIG = {
  baseUrl: 'http://39v04f7212.wicp.vip:80',
  //baseUrl: 'http://localhost:8000',
  loginEndpoint: '/login',
  extractEndpoint: '/api/extract',
  timeEndpoint: '/api/current_time',
  username: 'log',
  password: 'logs123',
};

// 登录状态
let isLoggedIn = false;

// 获取当前选中的版本
function getSelectedVersion() {
  return document.querySelector('input[name="version"]:checked').value;
}

// 获取当前选中的解析位置
function getSelectedAnalysisLocation() {
  return document.querySelector('input[name="analysisLocation"]:checked').value;
}

// 登录函数
async function login() {
  console.log('开始登录...');
  console.log('登录信息:', {
    username: '***',
    password: '***', // 隐藏密码
    url: `${API_CONFIG.baseUrl}${API_CONFIG.loginEndpoint}`
  });
  
  try {
    const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.loginEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: API_CONFIG.username,
        password: API_CONFIG.password
      }),
      credentials: 'include' // 包含Cookie
    });
    
    console.log('登录响应状态:', response.status);
    console.log('登录响应状态文本:', response.statusText);
    console.log('登录响应头:', Object.fromEntries(response.headers));
    
    // 尝试获取响应内容
    try {
      const responseText = await response.text();
      console.log('登录响应内容:', responseText);
    } catch (e) {
      console.log('无法获取登录响应内容:', e);
    }
    
    isLoggedIn = response.ok;
    console.log('登录结果:', isLoggedIn);
    return isLoggedIn;
  } catch (error) {
    console.error('登录失败:', error);
    isLoggedIn = false;
    return false;
  }
}

// 记录提取操作函数
async function recordExtract(responseTime, versionType) {
  console.log('开始记录提取操作...');
  
  // 获取软件版本号
  const softwareVersion = getExtensionVersion();
  
  console.log('记录信息:', {
    extensionId: extensionId,
    responseTime: responseTime,
    version: softwareVersion,
    versionType: versionType,
    isLoggedIn: isLoggedIn,
    url: `${API_CONFIG.baseUrl}${API_CONFIG.extractEndpoint}`
  });
  
  try {
    // 确保登录状态
    if (!isLoggedIn) {
      console.log('未登录，先尝试登录...');
      const loginSuccess = await login();
      if (!loginSuccess) {
        console.error('登录失败，无法记录提取操作');
        return false;
      }
    }
    
    // 发送提取记录请求
    console.log('开始发送提取记录API请求...');
    console.log('提取记录URL:', `${API_CONFIG.baseUrl}${API_CONFIG.extractEndpoint}`);
    console.log('提取记录参数:', {
      extensionId: extensionId,
      responseTime: responseTime,
      version: softwareVersion,
      versionType: versionType,
      username: API_CONFIG.username,
      password: API_CONFIG.password
    });
    
    const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.extractEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extensionId: extensionId,
        responseTime: responseTime,
        version: softwareVersion,
        versionType: versionType,
        username: API_CONFIG.username,
        password: API_CONFIG.password
      })
    });
    
    console.log('提取记录API响应状态:', response.status);
    console.log('提取记录API响应状态文本:', response.statusText);
    
    // 尝试获取响应内容
    try {
      const responseText = await response.text();
      console.log('提取记录API响应内容:', responseText);
      
      // 尝试解析JSON
      try {
        const result = JSON.parse(responseText);
        console.log('提取记录API响应解析结果:', result);
        return result.success;
      } catch (parseError) {
        console.error('解析响应失败:', parseError);
        console.log('响应内容:', responseText);
        return false;
      }
    } catch (textError) {
      console.error('获取响应内容失败:', textError);
      return false;
    }
  } catch (error) {
    console.error('记录提取操作失败:', error);
    // 显示错误提示
    showVerifyResult(`记录提取操作失败: ${error.message}`, 'error');
    return false;
  }
}

// 获取网络时间
async function getNetworkTime() {
  // 定义多个获取网络时间的函数
  const getTimeFromGoogle = async () => {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=invalid_token');
      const dateHeader = response.headers.get('date');
      if (dateHeader) {
        return new Date(dateHeader).getTime() / 1000;
      }
    } catch (error) {
      console.error('从Google获取网络时间失败:', error);
    }
    throw new Error('Failed to get time from Google');
  };

  const getTimeFromMicrosoft = async () => {
    try {
      const response = await fetch('https://www.microsoft.com');
      const dateHeader = response.headers.get('date');
      if (dateHeader) {
        return new Date(dateHeader).getTime() / 1000;
      }
    } catch (error) {
      console.error('从Microsoft获取网络时间失败:', error);
    }
    throw new Error('Failed to get time from Microsoft');
  };

  const getTimeFromCloudflare = async () => {
    try {
      const response = await fetch('https://www.cloudflare.com');
      const dateHeader = response.headers.get('date');
      if (dateHeader) {
        return new Date(dateHeader).getTime() / 1000;
      }
    } catch (error) {
      console.error('从Cloudflare获取网络时间失败:', error);
    }
    throw new Error('Failed to get time from Cloudflare');
  };

  const getTimeFromApple = async () => {
    try {
      const response = await fetch('https://www.apple.com');
      const dateHeader = response.headers.get('date');
      if (dateHeader) {
        return new Date(dateHeader).getTime() / 1000;
      }
    } catch (error) {
      console.error('从Apple获取网络时间失败:', error);
    }
    throw new Error('Failed to get time from Apple');
  };

  const getTimeFromAmazon = async () => {
    try {
      const response = await fetch('https://www.amazon.com');
      const dateHeader = response.headers.get('date');
      if (dateHeader) {
        return new Date(dateHeader).getTime() / 1000;
      }
    } catch (error) {
      console.error('从Amazon获取网络时间失败:', error);
    }
    throw new Error('Failed to get time from Amazon');
  };

  const getTimeFromInterfaceBox = async () => {
    try {
      const response = await fetch('https://www.baidu.com');
      const dateHeader = response.headers.get('date');
      if (dateHeader) {
        return new Date(dateHeader).getTime() / 1000;
      }
    } catch (error) {
      console.error('从接口盒子获取网络时间失败:', error);
    }
    throw new Error('Failed to get time from Interface Box');
  };

  const getTimeFromNTSC = async () => {
    try {
      const response = await fetch('https://www.ntsc.ac.cn');
      const dateHeader = response.headers.get('date');
      if (dateHeader) {
        return new Date(dateHeader).getTime() / 1000;
      }
    } catch (error) {
      console.error('从中国科学院国家授时中心获取网络时间失败:', error);
    }
    throw new Error('Failed to get time from NTSC');
  };

  const getTimeFromTencent = async () => {
    try {
      const response = await fetch('https://www.tencent.com');
      const dateHeader = response.headers.get('date');
      if (dateHeader) {
        return new Date(dateHeader).getTime() / 1000;
      }
    } catch (error) {
      console.error('从腾讯时间API获取网络时间失败:', error);
    }
    throw new Error('Failed to get time from Tencent');
  };

  const getTimeFromLocal = async () => {
    try {
      // 使用本地时间
      return Date.now() / 1000;
    } catch (error) {
      console.error('从本地获取时间失败:', error);
    }
    throw new Error('Failed to get time from local');
  };

  const getTimeFromKeyParser = async () => {
    try {
      // 先登录获取会话，使用JSON格式
      const loginResponse = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.loginEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          username: API_CONFIG.username, 
          password: API_CONFIG.password 
        }),
        credentials: 'include'
      });
      
      if (loginResponse.ok) {
        const loginData = await loginResponse.json();
        if (loginData.success) {
          // 然后调用时间API
          const timeResponse = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.timeEndpoint}`, {
            method: 'GET',
            credentials: 'include'
          });
          
          if (timeResponse.ok) {
            const data = await timeResponse.json();
            if (data.success) {
              return data.data.timestamp;
            }
          }
        }
      }
    } catch (error) {
      console.error('从解析key项目获取网络时间失败:', error);
    }
    throw new Error('Failed to get time from Key Parser');
  };

  try {
    // 并行请求所有时间源，使用第一个成功的
    const networkTime = await Promise.any([
//      getTimeFromGoogle(),
//      getTimeFromMicrosoft(),
//      getTimeFromCloudflare(),
//      getTimeFromApple(),
//      getTimeFromAmazon(),
//      getTimeFromInterfaceBox(),
//      getTimeFromNTSC(),
//      getTimeFromTencent(),
      getTimeFromKeyParser()
      //getTimeFromLocal()
    ]);
    return networkTime;
  } catch (error) {
    console.error('所有时间获取方式都失败:', error);
    // 所有方式都失败时使用本地时间作为最后的兜底
    return Date.now() / 1000;
  }
}

// 生成插件ID哈希（8位十六进制）
async function generateIdHash(id) {
  const encoder = new TextEncoder();
  const data = encoder.encode(id);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 8);
}

// 生成校验码（4位十六进制）
async function generateChecksum(id, timestamp) {
  const secret = "your-secret-key";
  const checksumInput = `${id}:${timestamp}:${secret}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(checksumInput);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 4);
}

// 保存key
async function saveKey() {
  const key = keyInput.value.trim();
  
  if (!key) {
    showVerifyResult('请输入key值', 'error');
    return;
  }
  
  try {
    // 检查key长度
    if (key.length !== 20) {
      throw new Error('无效的key格式，长度应为20位字符');
    }
    
    // 从连续字符串中提取各部分
    const idHash = key.substring(0, 8);
    const timestampHex = key.substring(8, 16);
    const checksum = key.substring(16, 20);
    
    // 验证插件ID哈希
    const currentIdHash = await generateIdHash(extensionId);
    if (currentIdHash !== idHash) {
      throw new Error('无效的key，插件ID不匹配');
    }
    
    // 将十六进制时间戳转换为十进制
    const timestamp = parseInt(timestampHex, 16);
    if (isNaN(timestamp) || timestamp <= 0) {
      throw new Error('无效的时间戳格式');
    }
    
    // 生成校验码并验证
    const generatedChecksum = await generateChecksum(extensionId, timestamp);
    if (generatedChecksum !== checksum) {
      throw new Error('无效的key，校验码不匹配');
    }
    
    // 提示开始激活
    showVerifyResult('开始激活，请保证网络连接。', 'success');
    
    // 验证成功，保存末日时间和key值
    chrome.storage.sync.set({ 'doomsdayTime': timestamp, 'savedKey': key }, async function() {
      // 更新UI状态
      updateKeyUI(true, key);
      // 更新插件状态（非自动激活，显示提示语）
      await updateExtensionStatus(false);
    });
  } catch (error) {
    // 格式错误、插件ID不匹配、时间戳无效、校验码不匹配时，设置为未激活状态
    extensionStatusElement.textContent = '未激活';
    extensionStatusElement.className = 'status-inactive';
    extractBtn.disabled = true;
    chrome.storage.sync.set({ 'extensionStatus': 'inactive' });
    chrome.storage.sync.remove(['savedKey', 'doomsdayTime']);
    updateKeyUI(false, '');
    showVerifyResult(`保存失败: ${error.message}`, 'error');
  }
}

// 显示验证结果
function showVerifyResult(message, type) {
  verifyResult.textContent = message;
  verifyResult.className = `verify-result verify-${type}`;
  verifyResult.style.display = 'block';
  
  // 3秒后隐藏结果
  setTimeout(() => {
    verifyResult.style.display = 'none';
  }, 3000);
}

// 更新key值UI状态
function updateKeyUI(hasSavedKey, key) {
  if (hasSavedKey && key) {
    // 有保存的key值
    keyInput.value = key;
    keyInput.disabled = true;
    saveBtn.style.display = 'none';
    modifyBtn.style.display = 'block';
  } else {
    // 没有保存的key值
    keyInput.value = '';
    keyInput.disabled = false;
    saveBtn.style.display = 'block';
    modifyBtn.style.display = 'none';
  }
}

// 处理修改按钮点击
function handleModify() {
  // 切换到可编辑状态
  keyInput.disabled = false;
  saveBtn.style.display = 'block';
  modifyBtn.style.display = 'none';
  // 聚焦到输入框
  keyInput.focus();
}

// 更新插件状态
async function updateExtensionStatus(isAutoActivate = false) {
  try {
    // 获取保存的末日时间
    const storageResult = await new Promise((resolve) => {
      chrome.storage.sync.get(['doomsdayTime', 'savedKey'], resolve);
    });
    
    const doomsdayTime = storageResult.doomsdayTime;
    const passwordVerificationElement = document.getElementById('password-verification');
    const versionSelectionElement = document.getElementById('version-selection');
    
    if (!doomsdayTime) {
      // 未激活状态
      extensionStatusElement.textContent = '未激活';
      extensionStatusElement.className = 'status-inactive';
      doomsdayTimeElement.textContent = '-';
      extractBtn.disabled = true;
      // 显示口令激活区域
      passwordVerificationElement.style.display = 'block';
      // 隐藏版本选择区域
      versionSelectionElement.style.display = 'none';
      // 保存状态到本地
      chrome.storage.sync.set({ 'extensionStatus': 'inactive' });
      return;
    }
    
    // 显示末日时间
    const doomsdayDate = new Date(doomsdayTime * 1000);
    const formattedDoomsdayTime = doomsdayDate.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    doomsdayTimeElement.textContent = formattedDoomsdayTime;
    
    // 获取网络时间
    const networkTime = await getNetworkTime();
    
    // 非自动激活时显示提示
    if (!isAutoActivate) {
      // 提示即将完成
      showVerifyResult('即将完成。', 'success');
      
      // 短暂延迟，让用户看到提示
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (doomsdayTime < networkTime) {
      // 超时状态 - 特殊处理为超时
      // 1. 插件状态更新为超时
      extensionStatusElement.textContent = '超时';
      extensionStatusElement.className = 'status-expired';
      extractBtn.disabled = true;
      // 显示口令激活区域
      passwordVerificationElement.style.display = 'block';
      // 隐藏版本选择区域
      versionSelectionElement.style.display = 'none';
      // 保存状态到本地
      chrome.storage.sync.set({ 'extensionStatus': 'expired' });
      // 2. 清除保存的激活码
      chrome.storage.sync.remove(['savedKey', 'doomsdayTime']);
      // 3. 更新UI状态
      updateKeyUI(false, '');
      // 4. 非自动激活时显示提示
      if (!isAutoActivate) {
        showVerifyResult('激活失败：密钥已超时', 'error');
      }
    } else {
      // 激活状态
      extensionStatusElement.textContent = '激活';
      extensionStatusElement.className = 'status-active';
      extractBtn.disabled = false;
      // 隐藏口令激活区域
      passwordVerificationElement.style.display = 'none';
      // 显示版本选择区域
      versionSelectionElement.style.display = 'block';
      // 保存状态到本地
      chrome.storage.sync.set({ 'extensionStatus': 'active' });
      // 非自动激活时显示提示
      if (!isAutoActivate) {
        showVerifyResult('激活成功！', 'success');
      }
    }
  } catch (error) {
    console.error('更新插件状态失败:', error);
    // 网络错误时，设置为未激活状态
    extensionStatusElement.textContent = '未激活';
    extensionStatusElement.className = 'status-inactive';
    doomsdayTimeElement.textContent = '-';
    extractBtn.disabled = true;
    // 显示口令激活区域
    const passwordVerificationElement = document.getElementById('password-verification');
    passwordVerificationElement.style.display = 'block';
    // 隐藏版本选择区域
    const versionSelectionElement = document.getElementById('version-selection');
    versionSelectionElement.style.display = 'none';
    // 保存状态到本地
    chrome.storage.sync.set({ 'extensionStatus': 'inactive' });
    // 清除保存的激活码
    chrome.storage.sync.remove(['savedKey', 'doomsdayTime']);
    // 更新UI状态
    updateKeyUI(false, '');
    // 非自动激活时显示提示
    if (!isAutoActivate) {
      showVerifyResult(`激活失败: ${error.message}`, 'error');
    }
  }
}

// 获取插件ID
function getExtensionId() {
  const id = chrome.runtime.id;
  console.log('获取插件ID:', id);
  return id;
}

// 防止提取试卷按钮点击事件重复触发的标志
let isProcessingExtract = false;

// 监听提取试卷按钮点击事件
extractBtn.addEventListener('click', async () => {
  // 如果已经在处理中，直接返回，防止重复触发
  if (isProcessingExtract) {
    console.log('已经在处理提取试卷操作，防止重复触发');
    return;
  }
  
  console.log('开始处理提取试卷操作');
  
  // 记录开始时间
  const startTime = performance.now();
  
  try {
    // 设置处理中标志
    isProcessingExtract = true;
    
    // 检查网络状态
    console.log('检查网络状态');
    const isOnline = navigator.onLine;
    console.log('网络状态:', isOnline);
    
    if (!isOnline) {
      // 无网络情况下，显示提示消息并取消提取试卷业务
      console.log('无网络连接，取消提取试卷操作');
      showVerifyResult('请确认网络状态后再试！', 'error');
      return;
    }
    
    // 获取当前活动标签页
    console.log('获取当前活动标签页');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('当前标签页:', tab);
    
    // 获取选中的版本
    const version = getSelectedVersion();
    console.log('选中的版本:', version);
    
    // 计算响应时间
    const responseTime = performance.now() - startTime;
    console.log('响应时间:', responseTime);
    
    // 先记录提取操作
    console.log('开始记录提取操作');
    console.log('调用recordExtract函数');
    const recordSuccess = await recordExtract(responseTime, version);
    console.log('记录提取操作结果:', recordSuccess);
    
    // 显示记录结果
    if (recordSuccess) {
      console.log('提取记录成功');
      showVerifyResult('提取记录成功，开始提取试卷', 'success');
    } else {
      console.log('提取记录失败');
      showVerifyResult('提取记录失败', 'error');
    }
    
    // 获取解析位置
    let analysisLocation = 'after-question'; // 默认值
    if (version === 'teacher') {
      analysisLocation = getSelectedAnalysisLocation();
      console.log('选中的解析位置:', analysisLocation);
    }
    
    // 向background.js发送消息，执行差异化处理和提取试卷功能
    console.log('向background.js发送提取试卷消息');
    chrome.runtime.sendMessage({
      action: 'extractPaper',
      tabId: tab.id,
      version: version,
      analysisLocation: analysisLocation
    }, (response) => {
      console.log('background.js响应:', response);
    });
    
    // 关闭弹出窗口 - 暂时注释掉，以便查看控制台日志
    console.log('准备关闭弹出窗口');
    // window.close(); // 暂时注释掉，以便查看完整的日志
  } catch (error) {
    console.error('提取试卷失败:', error);
    showVerifyResult('提取试卷失败，请稍后重试。', 'error');
    
    // 即使失败也记录操作
    const responseTime = performance.now() - startTime;
    console.log('失败时的响应时间:', responseTime);
    console.log('调用recordExtract函数（失败时）');
    await recordExtract(responseTime, version);
  } finally {
    // 重置处理中标志
    isProcessingExtract = false;
    console.log('重置处理中标志，操作完成');
  }
});

// 监听保存按钮点击事件
saveBtn.addEventListener('click', saveKey);

// 监听修改按钮点击事件
modifyBtn.addEventListener('click', handleModify);

// 获取插件版本号
function getExtensionVersion() {
  const manifest = chrome.runtime.getManifest();
  const version = manifest.version || '1.0.0';
  console.log('获取插件版本号:', version);
  return version;
}

// 定时激活检查的定时器ID
let activationCheckInterval = null;

// 执行激活流程
async function runActivationFlow() {
  console.log('执行激活流程...');
  try {
    // 检查是否有保存的key值
    const storageResult = await new Promise((resolve) => {
      chrome.storage.sync.get(['savedKey'], resolve);
    });
    
    const savedKey = storageResult.savedKey;
    
    if (savedKey) {
      // 如果有保存的激活码，验证并更新激活状态
      await validateSavedKey(savedKey, true);
    } else {
      // 如果没有保存的激活码，直接更新激活状态为未激活
      await updateExtensionStatus(true);
    }
  } catch (error) {
    console.error('执行激活流程失败:', error);
    // 1. 插件状态更新为未激活
    extensionStatusElement.textContent = '未激活';
    extensionStatusElement.className = 'status-inactive';
    extractBtn.disabled = true;
    chrome.storage.sync.set({ 'extensionStatus': 'inactive' });
    // 2. 清除保存的激活码
    chrome.storage.sync.remove(['savedKey', 'doomsdayTime']);
    // 3. 更新UI状态
    updateKeyUI(false, '');
  }
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
        saveAsWordBtn.style.display = 'block';
        saveAsPdfBtn.style.display = 'block';
        console.log('当前页面是提取试卷后的新页面，显示Word和PDF按钮');
      } else {
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
  // 获取插件ID
  extensionId = getExtensionId();
  extensionIdElement.textContent = extensionId;
  
  // 获取并显示插件版本号
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
    }
  });
  
  teacherRadio.addEventListener('change', function() {
    if (this.checked) {
      analysisLocationGroup.style.display = 'block';
    }
  });
  
  // 1. 激活状态默认设定为未激活
  console.log('初始化：默认设定为未激活状态');
  extensionStatusElement.textContent = '未激活';
  extensionStatusElement.className = 'status-inactive';
  extractBtn.disabled = true;
  
  // 2. 检查是否有保存的激活码
  const storageResult = await new Promise((resolve) => {
    chrome.storage.sync.get(['savedKey', 'doomsdayTime', 'extensionStatus'], resolve);
  });
  
  const savedKey = storageResult.savedKey;
  
  // 更新key值UI状态
  updateKeyUI(!!savedKey, savedKey);
  
  // 3. 根据是否有保存的激活码执行不同操作
  if (savedKey) {
    // 如果有保存的激活码，使用保存的激活码做跑激活流程
    console.log('发现保存的激活码，执行激活流程');
    await runActivationFlow();
  } else {
    // 如果没有保存的激活码，直接更新激活状态为未激活
    console.log('未发现保存的激活码，设置为未激活状态');
    await updateExtensionStatus(true);
  }
  
  // 更新保存为Word按钮的显示状态
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
  
  // 监听联系售后按钮点击事件
  contactSupportBtn.addEventListener('click', async () => {
    try {
      // 显示加载提示
      showVerifyResult('正在获取售后信息，请稍候...', 'success');
      
      // 获取pop框信息
      const popInfo = await getPopInfo();
      
      // 显示pop框信息
      if (popInfo && popInfo.success && popInfo.data) {
        showPopInfo(popInfo.data);
      } else {
        showVerifyResult('获取售后信息失败，请稍后重试', 'error');
      }
    } catch (error) {
      console.error('联系售后失败:', error);
      showVerifyResult(`联系售后失败: ${error.message}`, 'error');
    }
  });
  
  // 添加消息监听器，接收来自background.js的网络状态提示
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'networkStatus') {
      // 在插件弹框中显示网络状态提示
      showVerifyResult(message.message, 'error');
    }
  });
  
  // 4. 插件启动后，每10s跑一次激活流程
  console.log('启动定时激活检查，每10秒执行一次');
  if (activationCheckInterval) {
    clearInterval(activationCheckInterval);
  }
  activationCheckInterval = setInterval(runActivationFlow, 10000);
  
  // 建立与background.js的连接，用于检测弹框关闭事件
  console.log('建立与background.js的连接');
  const port = chrome.runtime.connect({ name: 'popup-connection' });
  
  // 连接建立成功（直接打印，因为Port对象没有onConnected事件）
  console.log('与background.js连接成功');
  
  // 连接断开时的处理（弹框关闭）
  port.onDisconnect.addListener(function() {
    console.log('与background.js连接断开');
  });
});

// 验证保存的key值
async function validateSavedKey(key, isAutoActivate = true) {
  try {
    // 检查key长度
    if (key.length !== 20) {
      throw new Error('无效的key格式，长度应为20位字符');
    }
    
    // 从连续字符串中提取各部分
    const idHash = key.substring(0, 8);
    const timestampHex = key.substring(8, 16);
    const checksum = key.substring(16, 20);
    
    // 验证插件ID哈希
    const currentIdHash = await generateIdHash(extensionId);
    if (currentIdHash !== idHash) {
      throw new Error('无效的key，插件ID不匹配');
    }
    
    // 将十六进制时间戳转换为十进制
    const timestamp = parseInt(timestampHex, 16);
    if (isNaN(timestamp) || timestamp <= 0) {
      throw new Error('无效的时间戳格式');
    }
    
    // 生成校验码并验证
    const generatedChecksum = await generateChecksum(extensionId, timestamp);
    if (generatedChecksum !== checksum) {
      throw new Error('无效的key，校验码不匹配');
    }
    
    // 验证成功，更新插件状态
    await updateExtensionStatus(isAutoActivate);
  } catch (error) {
    console.error('验证保存的key值失败:', error);
    // 格式错误、插件ID不匹配、时间戳无效、校验码不匹配时，设置为未激活状态
    extensionStatusElement.textContent = '未激活';
    extensionStatusElement.className = 'status-inactive';
    extractBtn.disabled = true;
    chrome.storage.sync.set({ 'extensionStatus': 'inactive' });
    // 清除保存的激活码
    chrome.storage.sync.remove(['savedKey', 'doomsdayTime']);
    // 更新UI状态
    updateKeyUI(false, '');
  }
}

// 监听保存为Word按钮点击事件
saveAsWordBtn.addEventListener('click', async () => {
  try {
    // 向background.js发送消息
    const response = await chrome.runtime.sendMessage({ action: 'convertPageToWord' });
    
    if (response.success && response.dataUrl && response.fileName) {
      // 创建下载链接
      const link = document.createElement('a');
      link.href = response.dataUrl;
      link.download = response.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showVerifyResult('转换成功！Word文档已保存。', 'success');
    } else if (response.success) {
      showVerifyResult('转换成功，但无法下载文件。', 'error');
    } else {
      showVerifyResult(`转换失败: ${response.error}`, 'error');
    }
  } catch (error) {
    console.error('保存为Word失败:', error);
    showVerifyResult(`保存为Word失败: ${error.message}`, 'error');
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

// 口令激活函数
async function activateByPassword() {
  const password = passwordInput.value.trim();
  
  if (!password) {
    showVerifyResult('请输入口令', 'error');
    return;
  }
  
  try {
    // 提示开始激活
    showVerifyResult('开始通过口令激活，请保证网络连接。', 'success');
    
    // 调用口令获取激活码API
    const response = await fetch(`${API_CONFIG.baseUrl}/api/get_key_by_password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        extension_id: extensionId,
        password: password
      })
    });
    
    if (!response.ok) {
      throw new Error('网络请求失败');
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || '获取激活码失败');
    }
    
    const key = data.data.key;
    
    // 验证激活码格式
    if (!key || key.length !== 20) {
      throw new Error('获取的激活码格式错误');
    }
    
    // 从连续字符串中提取各部分
    const idHash = key.substring(0, 8);
    const timestampHex = key.substring(8, 16);
    const checksum = key.substring(16, 20);
    
    // 验证插件ID哈希
    const currentIdHash = await generateIdHash(extensionId);
    if (currentIdHash !== idHash) {
      throw new Error('无效的激活码，插件ID不匹配');
    }
    
    // 将十六进制时间戳转换为十进制
    const timestamp = parseInt(timestampHex, 16);
    if (isNaN(timestamp) || timestamp <= 0) {
      throw new Error('无效的时间戳格式');
    }
    
    // 生成校验码并验证
    const generatedChecksum = await generateChecksum(extensionId, timestamp);
    if (generatedChecksum !== checksum) {
      throw new Error('无效的激活码，校验码不匹配');
    }
    
    // 验证成功，保存末日时间和key值
    chrome.storage.sync.set({ 'doomsdayTime': timestamp, 'savedKey': key }, async function() {
      // 更新UI状态
      updateKeyUI(true, key);
      // 更新插件状态（非自动激活，显示提示语）
      await updateExtensionStatus(false);
      // 清空口令输入框
      passwordInput.value = '';
      // 提示激活成功
      showVerifyResult('口令激活成功！', 'success');
    });
  } catch (error) {
    // 激活失败，设置为未激活状态
    extensionStatusElement.textContent = '未激活';
    extensionStatusElement.className = 'status-inactive';
    extractBtn.disabled = true;
    chrome.storage.sync.set({ 'extensionStatus': 'inactive' });
    chrome.storage.sync.remove(['savedKey', 'doomsdayTime']);
    updateKeyUI(false, '');
    showVerifyResult(`激活失败: ${error.message}`, 'error');
  }
}

// 监听口令激活按钮点击事件
activateByPasswordBtn.addEventListener('click', activateByPassword);

// 获取pop框信息
async function getPopInfo() {
  try {
    const response = await fetch(`${API_CONFIG.baseUrl}/api/plugin/pop_info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('网络请求失败');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('获取pop框信息失败:', error);
    throw error;
  }
}

// 显示pop框信息
function showPopInfo(popData) {
  // 创建pop框元素
  const popContainer = document.createElement('div');
  popContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  `;
  
  // 创建pop框内容
  const popContent = document.createElement('div');
  popContent.style.cssText = `
    background-color: white;
    padding: 20px;
    border-radius: 8px;
    width: 90%;
    max-width: 400px;
    max-height: 80%;
    overflow-y: auto;
  `;
  
  // 添加标题
  if (popData.title) {
    const title = document.createElement('h3');
    title.textContent = popData.title;
    title.style.cssText = 'margin-top: 0; margin-bottom: 15px; text-align: center;';
    popContent.appendChild(title);
  }
  
  // 添加内容
  if (popData.content) {
    const content = document.createElement('div');
    content.textContent = popData.content;
    content.style.cssText = 'margin-bottom: 15px; line-height: 1.5;';
    popContent.appendChild(content);
  }
  
  // 添加图片
  if (popData.image_path) {
    const image = document.createElement('img');
    // 修复图片路径：如果是相对路径，添加服务器地址前缀
    let imageSrc = popData.image_path;
    if (imageSrc.startsWith('/')) {
      imageSrc = API_CONFIG.baseUrl + imageSrc;
    }
    image.src = imageSrc;
    image.alt = '售后信息图片';
    image.style.cssText = 'max-width: 100%; max-height: 200px; margin-bottom: 15px;';
    popContent.appendChild(image);
  }
  
  // 添加关闭按钮
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '关闭';
  closeBtn.style.cssText = `
    display: block;
    margin: 0 auto;
    padding: 10px 20px;
    background-color: #4285F4;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  `;
  
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(popContainer);
  });
  
  popContent.appendChild(closeBtn);
  popContainer.appendChild(popContent);
  document.body.appendChild(popContainer);
}