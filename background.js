// 是否需要中断verifyActivationStatus函数的执行
let shouldInterruptVerification = false;

// 弹出窗口连接状态
let popupPort = null;

// 浏览器启动时初始化
chrome.runtime.onStartup.addListener(async () => {
  await initializeExtension();
});

// 插件安装时初始化
chrome.runtime.onInstalled.addListener(async () => {
  await initializeExtension();
});

// 初始化插件
async function initializeExtension() {
  try {
    // 获取插件ID
    const extensionId = chrome.runtime.id;
    
    // 检查是否有保存的key值
    const storageResult = await new Promise((resolve) => {
      chrome.storage.sync.get(['savedKey', 'doomsdayTime'], resolve);
    });
    
    const savedKey = storageResult.savedKey;
    
    if (savedKey) {
      // 验证保存的key值
      await validateSavedKey(savedKey, extensionId);
    }
  } catch (error) {
    console.error('初始化插件失败:', error);
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

// 验证保存的key值
async function validateSavedKey(key, extensionId) {
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
    
    // 验证成功，保存末日时间
    await new Promise((resolve) => {
      chrome.storage.sync.set({ 'doomsdayTime': timestamp }, resolve);
    });
    
    console.log('验证保存的key值成功');
  } catch (error) {
    console.error('验证保存的key值失败:', error);
    // 格式错误、插件ID不匹配、时间戳无效、校验码不匹配时，设置为未激活状态
    await new Promise((resolve) => {
      chrome.storage.sync.set({ 'extensionStatus': 'inactive' }, resolve);
    });
    // 验证失败，清除保存的key值
    await new Promise((resolve) => {
      chrome.storage.sync.remove(['savedKey', 'doomsdayTime'], resolve);
    });
  }
}

// 验证激活状态的函数
async function verifyActivationStatus() {
  return new Promise(async (resolve) => {
    // 重置中断标志
    shouldInterruptVerification = false;
    
    // 获取保存的激活码
    const storageResult = await new Promise((resolve) => {
      chrome.storage.sync.get(['savedKey'], resolve);
    });
    
    const savedKey = storageResult.savedKey;
    
    if (!savedKey) {
      resolve({ status: '未激活', message: '未找到激活码' });
      return;
    }
    
    try {
      // 尝试调用服务端验证API
      const response = await fetch('http://39v04f7212.wicp.vip:80/api/verify_key', {
      //const response = await fetch('http://localhost:8000/api/verify_key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key: savedKey })
      });
      
      // 检查是否需要中断
      if (shouldInterruptVerification) {
        console.log('验证过程被中断');
        resolve({ status: '未激活', message: '验证过程被中断' });
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          resolve({ status: data.status, message: '验证成功' });
        } else {
          resolve({ status: '未激活', message: data.message || '验证失败' });
        }
      } else {
        resolve({ status: '未激活', message: '网络请求失败' });
      }
    } catch (error) {
      console.error('验证激活状态失败:', error);
      
      // 检查是否需要中断
      if (shouldInterruptVerification) {
        console.log('验证过程被中断');
        resolve({ status: '未激活', message: '验证过程被中断' });
        return;
      }
      
      // API调用失败时，设置超时处理
      let timeout5s, timeout10s, timeout20s, timeout40s;
      let timeoutTriggered = false;
      
      // 5秒超时
      timeout5s = setTimeout(() => {
        if (!timeoutTriggered && !shouldInterruptVerification) {
          console.log('5秒内未返回：确认网络状态！');
          // 向popup.js发送提示消息，继续等待
          chrome.runtime.sendMessage({ action: 'networkStatus', message: '尝试重新提取！' });
        }
      }, 5000);
      
      // 10秒超时
      timeout10s = setTimeout(() => {
        if (!timeoutTriggered && !shouldInterruptVerification) {
          console.log('10秒内未返回：尝试重新提取！');
          // 向popup.js发送提示消息，继续等待
          chrome.runtime.sendMessage({ action: 'networkStatus', message: '服务异常，请尝试重新提取！' });
        }
      }, 10000);
	  
      // 20秒超时
      timeout20s = setTimeout(() => {
        if (!timeoutTriggered && !shouldInterruptVerification) {
          console.log('20秒内未返回：尝试重新提取！');
          // 向popup.js发送提示消息，继续等待
          chrome.runtime.sendMessage({ action: 'networkStatus', message: '请退出后，再次尝试重新提取！' });
        }
      }, 20000);
	  
      // 40秒超时
      timeout60s = setTimeout(() => {
        if (!timeoutTriggered && !shouldInterruptVerification) {
          timeoutTriggered = true;
          console.log('60秒内未返回：网络错误，请尝试重新提取！');
          // 60秒超时继续执行提取试卷业务
          resolve({ status: '激活', message: '网络超时，继续执行提取试卷业务' });
        }
      }, 60000);
      
      // 定期检查中断标志
      const checkInterruptInterval = setInterval(() => {
        if (shouldInterruptVerification) {
          console.log('验证过程被中断，清除所有定时器');
          // 清除所有定时器
          clearTimeout(timeout5s);
          clearTimeout(timeout10s);
          clearTimeout(timeout20s);
          clearTimeout(timeout60s);
          clearInterval(checkInterruptInterval);
          resolve({ status: '未激活', message: '验证过程被中断' });
        }
      }, 100); // 增加检查频率，确保及时响应
    }
  });
}

// 监听来自popup.js的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractPaper') {
    // 执行差异化处理和提取试卷功能
    executeExtractPaper(message.tabId, message.version, message.analysisLocation);
    sendResponse({ success: true });
  } else if (message.action === 'interruptVerification') {
    // 处理中断验证消息
    console.log('收到中断验证消息');
    shouldInterruptVerification = true;
    sendResponse({ success: true });
  } else if (message.action === 'convertPageToWord') {
    // 执行网页转Word功能
    convertPageToWord(sendResponse);
    return true; // 表示会异步发送响应
  }
});

// 监听弹出窗口连接
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup-connection') {
    console.log('弹出窗口已连接');
    popupPort = port;
    
    // 监听连接断开
    port.onDisconnect.addListener(() => {
      console.log('弹出窗口已断开连接');
      popupPort = null;
      // 当弹出窗口断开连接时，中断验证过程
      shouldInterruptVerification = true;
    });
  }
});

// 执行差异化处理和提取试卷功能
async function executeExtractPaper(tabId, version, analysisLocation) {
  try {
    // 验证激活状态
    const activationResult = await verifyActivationStatus();
    
    if (activationResult.status === '未激活') {
      // 更新插件状态为未激活
      await new Promise((resolve) => {
        chrome.storage.sync.remove(['savedKey', 'doomsdayTime'], resolve);
      });
      
      // 向popup.js发送提示消息
      chrome.runtime.sendMessage({ action: 'networkStatus', message: '请重新激活！' });
      
      // 不做后续提取试卷业务
      return;
    }
    
    // 激活状态正常，继续执行原业务
    // 先获取当前页面信息
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = currentTab.url;
    
    // 执行差异化处理
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (version, analysisLocation) => {
        return new Promise(resolve => {
          const currentUrl = window.location.href;
          
          // 差异化处理逻辑
          if (currentUrl.includes('zujuan.xkw.com')) {
            // 查找所有解析元素
            // 假设解析元素有特定的class，这里使用常见的可能命名
            const analysisSelectors = [
              '.exam-item__analysis',
              '.analysis',
              '.解析',
              '[class*="analysis"]',
              '[class*="解析"]',
              '[id*="analysis"]',
              '[id*="解析"]'
            ];
            
            // 获取所有可能的解析元素
            let analysisElements = [];
            analysisSelectors.forEach(selector => {
              const elements = document.querySelectorAll(selector);
              analysisElements = [...analysisElements, ...elements];
            });
            
            // 去重
            analysisElements = [...new Set(analysisElements)];
            
            if (version === 'student') {
              // 学生版：隐藏每一个解析
              analysisElements.forEach(element => {
                // 隐藏元素的多种方式，确保兼容性
                element.style.display = 'none';
                element.style.visibility = 'hidden';
                element.setAttribute('hidden', 'hidden');
                element.classList.add('hidden');
              });
              
              // 另外，查找并点击每一个.exam-item__cnt元素，可能会触发隐藏解析的操作
              // 根据题目属性决定是否点击
              const examItemCntElements = document.querySelectorAll('.exam-item__cnt');
              examItemCntElements.forEach(element => {
                // 查找当前题目对应的.exam-item__opt元素
                // 尝试多种方式查找.exam-item__opt元素
                let examItemOpt = null;
                
                // 方式1：通过closest('.exam-item')查找
                examItemOpt = element.closest('.exam-item')?.querySelector('.exam-item__opt');
                
                // 方式2：如果方式1失败，尝试直接在父元素中查找
                if (!examItemOpt) {
                  examItemOpt = element.parentElement?.querySelector('.exam-item__opt');
                }
                
                // 方式3：如果方式2失败，尝试在祖父元素中查找
                if (!examItemOpt) {
                  examItemOpt = element.parentElement?.parentElement?.querySelector('.exam-item__opt');
                }
                
                if (examItemOpt) {
                  // 检查.exam-item__opt元素是否有hidden属性
                  // 使用多种方式检查hidden属性
                  const hasHiddenAttribute = examItemOpt.hasAttribute('hidden') || 
                                           examItemOpt.getAttribute('hidden') === 'hidden' ||
                                           examItemOpt.style.display === 'none' ||
                                           examItemOpt.style.visibility === 'hidden';
                  
                  // 如果没有hidden属性，则点击该题目
                  if (!hasHiddenAttribute) {
                    element.click();
                  }
                } else {
                  // 如果找不到对应的.exam-item__opt元素，默认点击
                  element.click();
                }
              });
            } else if (version === 'teacher') {
              // 教师版：展示每一个解析
              analysisElements.forEach(element => {
                // 显示元素的多种方式，确保兼容性
                element.style.display = '';
                element.style.visibility = 'visible';
                element.removeAttribute('hidden');
                element.classList.remove('hidden');
              });
              
              // 另外，查找并点击每一个.exam-item__cnt元素，可能会触发显示解析的操作
              // 根据题目属性决定是否点击（与学生版相反）
              const examItemCntElements = document.querySelectorAll('.exam-item__cnt');
              examItemCntElements.forEach(element => {
                // 查找当前题目对应的.exam-item__opt元素
                // 尝试多种方式查找.exam-item__opt元素
                let examItemOpt = null;
                
                // 方式1：通过closest('.exam-item')查找
                examItemOpt = element.closest('.exam-item')?.querySelector('.exam-item__opt');
                
                // 方式2：如果方式1失败，尝试直接在父元素中查找
                if (!examItemOpt) {
                  examItemOpt = element.parentElement?.querySelector('.exam-item__opt');
                }
                
                // 方式3：如果方式2失败，尝试在祖父元素中查找
                if (!examItemOpt) {
                  examItemOpt = element.parentElement?.parentElement?.querySelector('.exam-item__opt');
                }
                
                if (examItemOpt) {
                  // 检查.exam-item__opt元素是否有hidden属性
                  // 使用多种方式检查hidden属性
                  const hasHiddenAttribute = examItemOpt.hasAttribute('hidden') || 
                                           examItemOpt.getAttribute('hidden') === 'hidden' ||
                                           examItemOpt.style.display === 'none' ||
                                           examItemOpt.style.visibility === 'hidden';
                  
                  // 教师版：与学生版相反，如果有hidden属性，则点击该题目
                  if (hasHiddenAttribute) {
                    element.click();
                  }
                } else {
                  // 如果找不到对应的.exam-item__opt元素，默认点击
                  element.click();
                }
              });
            }
          }
          
          // 等待666毫秒确保点击操作完全完成
          setTimeout(() => {
            resolve();
          }, 666);
        });
      },
      args: [version, analysisLocation]
    });
    
    // 额外添加500毫秒延迟，确保页面完全稳定
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 执行提取试卷功能
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (version, analysisLocation) => {
        // 获取当前页面URL
        const currentUrl = window.location.href;
        let contentElement = null;
        
        // 检查面包屑导航
        const breadNavItems = document.querySelectorAll('a.item.bread-nav-item');
        let breadNavContent = '';
        
        breadNavItems.forEach(item => {
          const text = item.textContent.trim();
          const href = item.getAttribute('href');
          if (text === '上好课' || text === '试卷详情页' || text === '试卷详情' || text === '专辑详情' || text === '组卷中心' || text === '智能组卷' || (text === '高考真题' && href === '/gkzt/') || text === '中考真题' || text === '分享试卷详情') {
            breadNavContent = text;
          }
        });
        
        // 根据面包屑导航内容决定提取哪个元素
        if (breadNavContent === '上好课') {
          contentElement = document.querySelector('article.exam-cnt');
        } else if (breadNavContent === '试卷详情页' || breadNavContent === '试卷详情') {
          contentElement = document.querySelector('article.exam-cnt');
        } else if (breadNavContent === '高考真题') {
          contentElement = document.querySelector('article.exam-cnt');
        } else if (breadNavContent === '中考真题') {
          contentElement = document.querySelector('article.exam-cnt');
        } else if (breadNavContent === '分享试卷详情') {
          contentElement = document.querySelector('article.exam-cnt');
        } else if (breadNavContent === '专辑详情') {
          contentElement = document.querySelector('div.qml_paper.ques-list');
        } else if (breadNavContent === '组卷中心') {
          // 使用zujuan.xkw.com网站的处理方式
          contentElement = document.querySelector('article.paper-cnt.clearfix');
		} else if (breadNavContent === '智能组卷') {
          // 提取section#quesListBox元素的内容
          contentElement = document.querySelector('section#quesListBox');
        } else {
          // 默认使用zujuan.xkw.com网站的处理方式
          contentElement = document.querySelector('article.paper-cnt.clearfix');
        }
        
        if (contentElement) {
          // 获取所有样式表（包括内联style标签和外部link标签）
          const styleSheets = Array.from(document.styleSheets).map(sheet => {
            try {
              // 对于外部样式表，获取其URL
              if (sheet.href) {
                return `<link rel="stylesheet" href="${sheet.href}">`;
              } 
              // 对于内联样式表，获取其CSS规则
              else {
                const rules = Array.from(sheet.cssRules || []).map(rule => rule.cssText).join('\n');
                return `<style>${rules}</style>`;
              }
            } catch (e) {
              // 忽略无法访问的样式表（如跨域）
              return '';
            }
          }).join('\n');

          // 获取内容元素的完整HTML结构（包括class属性和内联样式）
          const articleHtml = contentElement.outerHTML;
          
          // 创建临时DOM来处理HTML，移除指定元素
          const parser = new DOMParser();
          const doc = parser.parseFromString(articleHtml, 'text/html');
          
          // 移除不需要的元素
          // 找到并移除所有.ques-ctrl.clearfix元素
          const quesCtrlElements = doc.querySelectorAll('.ques-ctrl.clearfix');
          quesCtrlElements.forEach(element => {
            element.remove();
          });
          
          // 找到并移除所有.btn-box.clearfix元素
          const btnBoxElements = doc.querySelectorAll('.btn-box.clearfix');
          btnBoxElements.forEach(element => {
            element.remove();
          });
          
          // 找到并移除所有.ctrl-box元素
          const ctrlBoxElements = doc.querySelectorAll('.ctrl-box');
          ctrlBoxElements.forEach(element => {
            element.remove();
          });
          
          // 找到并移除所有.exam-item__info clearfix元素
          const examItemInfoElements = doc.querySelectorAll('.exam-item__info.clearfix');
          examItemInfoElements.forEach(element => {
            element.remove();
          });
          
          // 找到并移除所有.top-msg元素
          const topMsgElements = doc.querySelectorAll('.top-msg');
          topMsgElements.forEach(element => {
            element.remove();
          });
          
          // 找到并移除所有.msg-box元素
          const msgBoxElements = doc.querySelectorAll('.msg-box');
          msgBoxElements.forEach(element => {
            element.remove();
          });
          
          // 找到并移除所有.info-list元素
          const infoListElements = doc.querySelectorAll('.info-list');
          infoListElements.forEach(element => {
            element.remove();
          });
          
          // 处理.analyze-title元素，移除其中的"导出"字样
          const analyzeTitleElements = doc.querySelectorAll('.analyze-title');
          analyzeTitleElements.forEach(element => {
            // 替换文本内容，移除"导出"字样
            if (element.textContent.includes('导出')) {
              element.textContent = element.textContent.replace('导出', '');
            }
          });
          
          // 处理.title-txt元素
          const titleTxtElements = doc.querySelectorAll('.title-txt');
          titleTxtElements.forEach(element => {
            // 设置为可编辑
            element.contentEditable = 'true';
            element.readOnly = false;
            element.style.pointerEvents = 'auto';
            element.style.userSelect = 'auto';
            element.setAttribute('contenteditable', 'true');
            // 设置为居中对齐
            element.style.textAlign = 'center';
          });
          
          // 根据面包屑内容差异化获取页面标题
          let pageTitle = '提取的试卷内容';
          
          // 高考真题、中考真题、分享试卷详情和试卷详情 - 使用<span class="title-txt"></span>
          if (breadNavContent === '高考真题' || breadNavContent === '中考真题' || breadNavContent === '分享试卷详情' || breadNavContent === '试卷详情') {
            const titleTxtElement = doc.querySelector('.title-txt');
            if (titleTxtElement) {
              pageTitle = titleTxtElement.textContent.trim() || pageTitle;
              
              // 设置.title-txt元素为可修改
              titleTxtElement.contentEditable = 'true';
              titleTxtElement.readOnly = false;
              titleTxtElement.style.pointerEvents = 'auto';
              titleTxtElement.style.userSelect = 'auto';
              titleTxtElement.style.textAlign = 'center';
              titleTxtElement.setAttribute('contenteditable', 'true');
            }
          }
          // 组卷中心 - 使用<div id="pui_maintitle"></div>
          else if (breadNavContent === '组卷中心') {
            const puiMainTitleElement = doc.getElementById('pui_maintitle');
            if (puiMainTitleElement) {
              pageTitle = puiMainTitleElement.textContent.trim() || pageTitle;
              
              // 设置#pui_maintitle元素为可修改并设置字体样式
              puiMainTitleElement.contentEditable = 'true';
              puiMainTitleElement.readOnly = false;
              puiMainTitleElement.style.pointerEvents = 'auto';
              puiMainTitleElement.style.userSelect = 'auto';
              puiMainTitleElement.style.textAlign = 'center';
              puiMainTitleElement.style.fontSize = '24px'; // 二号字体
              puiMainTitleElement.style.fontWeight = 'bold'; // 加粗
              puiMainTitleElement.setAttribute('contenteditable', 'true');
            }
          }
          // 试卷详情页 - 使用<span class="txt"></span>
          else if (breadNavContent === '试卷详情页') {
            const txtElement = doc.querySelector('.txt');
            if (txtElement) {
              pageTitle = txtElement.textContent.trim() || pageTitle;
              
              // 设置.txt元素为可修改
              txtElement.contentEditable = 'true';
              txtElement.readOnly = false;
              txtElement.style.pointerEvents = 'auto';
              txtElement.style.userSelect = 'auto';
              txtElement.style.textAlign = 'center';
              txtElement.setAttribute('contenteditable', 'true');
            }
          }
          // 上好课 - 使用<title></title>
          else if (breadNavContent === '上好课') {
            // 从原页面title标签获取
            if (document.title) {
              pageTitle = document.title.trim() || pageTitle;
            }
          }
          // 专辑详情 - 使用<title></title>
          else if (breadNavContent === '专辑详情') {
            // 从原页面title标签获取
            if (document.title) {
              pageTitle = document.title.trim() || pageTitle;
            }
          }
          // 其他情况 - 保持原有逻辑
          else {
            // 优先从#pui_maintitle获取页面标题
            const puiMainTitleElement = doc.getElementById('pui_maintitle');
            if (puiMainTitleElement) {
              pageTitle = puiMainTitleElement.textContent.trim() || pageTitle;
              
              // 设置#pui_maintitle元素为可修改并设置字体样式
              puiMainTitleElement.contentEditable = 'true';
              puiMainTitleElement.readOnly = false;
              puiMainTitleElement.style.pointerEvents = 'auto';
              puiMainTitleElement.style.userSelect = 'auto';
              puiMainTitleElement.style.textAlign = 'center';
              puiMainTitleElement.style.fontSize = '24px'; // 二号字体
              puiMainTitleElement.style.fontWeight = 'bold'; // 加粗
              puiMainTitleElement.setAttribute('contenteditable', 'true');
            } 
            
            // 从.paper-title获取页面标题（如果#pui_maintitle不存在或内容为空）
            if (pageTitle === '提取的试卷内容') {
              const paperTitleElements = doc.querySelectorAll('.paper-title');
              paperTitleElements.forEach(element => {
                element.style.fontSize = '24px'; // 二号字体
                element.style.fontWeight = 'bold'; // 加粗
                element.style.textAlign = 'center'; // 居中对齐
                // 设置为可编辑
                element.contentEditable = 'true';
                element.readOnly = false;
                element.style.pointerEvents = 'auto';
                element.style.userSelect = 'auto';
                element.setAttribute('contenteditable', 'true');
                
                // 获取第一个.paper-title元素的文本内容作为页面标题
                if (!pageTitle || pageTitle === '提取的试卷内容') {
                  pageTitle = element.textContent.trim() || pageTitle;
                }
              });
            } else {
              // 如果已经从#pui_maintitle获取了标题，仍然需要设置.paper-title的样式
              const paperTitleElements = doc.querySelectorAll('.paper-title');
              paperTitleElements.forEach(element => {
                element.style.fontSize = '24px'; // 二号字体
                element.style.fontWeight = 'bold'; // 加粗
                element.style.textAlign = 'center'; // 居中对齐
                // 设置为可编辑
                element.contentEditable = 'true';
                element.readOnly = false;
                element.style.pointerEvents = 'auto';
                element.style.userSelect = 'auto';
                element.setAttribute('contenteditable', 'true');
              });
            }
          }
          
          // 去除所有跳转链接
          const links = doc.querySelectorAll('a');
          links.forEach(link => {
            // 保留链接文本，但移除链接功能
            const linkText = link.textContent;
            const linkParent = link.parentNode;
            if (linkParent) {
              // 创建文本节点替换链接
              const textNode = document.createTextNode(linkText);
              linkParent.replaceChild(textNode, link);
            }
          });
          
          // 处理h4.sec-title.clearfix元素，保留其中的span内容
          const secTitleElements = doc.querySelectorAll('h4.sec-title.clearfix');
          secTitleElements.forEach(element => {
            const spanElements = element.querySelectorAll('span');
            if (spanElements.length > 0) {
              // 创建一个容器来保存span内容
              const container = doc.createElement('div');
              spanElements.forEach(span => {
                container.appendChild(span.cloneNode(true));
              });
              // 将容器插入到h4元素之前
              element.parentNode.insertBefore(container, element);
            }
            // 移除h4元素
            element.remove();
          });
          
          // 移除section.exam-analyze元素
          const examAnalyzeElements = doc.querySelectorAll('section.exam-analyze');
          examAnalyzeElements.forEach(element => {
            element.remove();
          });
          
          // 去除.item.answer元素中图片的灰色水印和背景色
          const itemAnswerElements = doc.querySelectorAll('.item.answer');
          itemAnswerElements.forEach(item => {
            // 找到所有图片元素
            const images = item.querySelectorAll('img');
            images.forEach(img => {
              // 移除可能的滤镜效果（比如grayscale）
              img.style.filter = 'none';
              // 确保图片不透明
              img.style.opacity = '1';
              // 设置图片背景色为透明，与页面背景色融合
              img.style.backgroundColor = 'transparent';
              // 确保图片没有边框
              img.style.border = 'none';
              // 确保图片没有轮廓
              img.style.outline = 'none';
              // 确保图片显示方式为块级，避免底部间隙
              img.style.display = 'block';
              // 移除可能的伪元素（通过添加样式覆盖）
              img.style.position = 'relative';
            });
            
            // 移除可能的水印覆盖层元素
            const watermarkElements = item.querySelectorAll('[class*="watermark"], [id*="watermark"], .水印, .shuiyin');
            watermarkElements.forEach(watermark => {
              watermark.remove();
            });
            
            // 移除item.answer元素上可能的水印相关样式和背景色
            item.style.filter = 'none';
            item.style.background = 'transparent';
            // 确保item.answer元素与页面背景色一致
            item.style.backgroundColor = 'transparent';
          });
          
          // 为.item.answer元素添加CSS，防止伪元素显示水印
          const style = doc.createElement('style');
          style.textContent = `
            .item.answer::before,
            .item.answer::after,
            .item.answer img::before,
            .item.answer img::after {
              display: none !important;
              content: none !important;
            }
          `;
          doc.head.appendChild(style);
          
          // 获取处理后的article HTML
          const processedArticleHtml = doc.body.innerHTML;
          
          // 根据选择的版本添加后缀
          let titleWithVersion = pageTitle;
          if (version === 'student') {
            titleWithVersion += ' -学生版';
          } else if (version === 'teacher') {
            titleWithVersion += ' -教师版';
          }
          
          // 创建试卷内容的新窗口
          const newWindow = window.open('', '_blank');
          
          // 先写入基础HTML结构
          newWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>${titleWithVersion}</title>
              ${styleSheets}
              <style>
                /* 基础样式，确保内容在新页面中正常显示 */
                body {
                  margin: 0;
                  padding: 20px;
                  background-color: #f5f5f5;
                  cursor: pointer;
                }
                
                /* 顶部按钮容器 */
                .top-buttons {
                  position: fixed;
                  top: 10px;
                  right: 10px;
                  z-index: 1000;
                  display: flex;
                  gap: 10px;
                  background-color: white;
                  padding: 10px;
                  border-radius: 5px;
                  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }
                
                .top-buttons button {
                  padding: 8px 16px;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 14px;
                }
                
                .top-buttons .word-btn {
                  background-color: #4CAF50;
                  color: white;
                }
                
                .top-buttons .pdf-btn {
                  background-color: #2196F3;
                  color: white;
                }
                
                /* 使title-txt内容居中对齐 */
                span.title-txt {
                  display: block;
                  text-align: center;
                }
                
                /* 打印样式，确保页面在打印时显示良好 */
                @media print {
                  body {
                    background-color: white;
                    margin: 0;
                    padding: 0;
                    cursor: default;
                  }
                  
                  .top-buttons {
                    display: none;
                  }
                }
              </style>
            </head>
            <body>
              <!-- 顶部按钮 -->
              <div class="top-buttons">
                <button class="word-btn" id="download-word-btn">试用Word</button>
                <button class="pdf-btn" id="download-pdf-btn">下载PDF</button>
              </div>
              
              ${processedArticleHtml}
            </body>
            </html>
          `);
          
          newWindow.document.close();
          
          // 文档加载完成后添加点击事件监听器
          newWindow.addEventListener('load', function() {
            // 确保paper-title元素可编辑
            const paperTitleElements = newWindow.document.querySelectorAll('.paper-title');
            paperTitleElements.forEach(element => {
              element.contentEditable = 'true';
              element.readOnly = false;
              element.style.pointerEvents = 'auto';
              element.style.userSelect = 'auto';
              element.setAttribute('contenteditable', 'true');
            });
            
            // 确保pui_studentinput元素可编辑并居中显示
            const studentInputElement = newWindow.document.getElementById('pui_studentinput');
            if (studentInputElement) {
              studentInputElement.contentEditable = 'true';
              studentInputElement.readOnly = false;
              studentInputElement.style.pointerEvents = 'auto';
              studentInputElement.style.userSelect = 'auto';
              studentInputElement.style.textAlign = 'center';
              studentInputElement.setAttribute('contenteditable', 'true');
            }
            
            // 确保具有特定样式的p元素可编辑
            const pElements = newWindow.document.querySelectorAll('p');
            pElements.forEach(element => {
              const lineHeight = element.style.lineHeight;
              const textAlign = element.style.textAlign;
              if (lineHeight === '19px' && textAlign === 'center') {
                element.contentEditable = 'true';
                element.readOnly = false;
                element.style.pointerEvents = 'auto';
                element.style.userSelect = 'auto';
                element.setAttribute('contenteditable', 'true');
              }
            });
            
            // 处理解析位置
            if (version === 'teacher' && analysisLocation === 'at-end') {
              // 收集所有.exam-item__opt元素的内容
              const examItemOptElements = newWindow.document.querySelectorAll('.exam-item__opt');
              const analysisContents = [];
              
              // 收集内容并移除原元素
              examItemOptElements.forEach(element => {
                analysisContents.push(element.outerHTML);
                element.remove();
              });
              
              // 如果有解析内容，将其添加到页面末尾
              if (analysisContents.length > 0) {
                // 创建解析部分的标题
                const analysisTitle = newWindow.document.createElement('div');
                analysisTitle.innerHTML = '<h2 style="text-align: center; margin-top: 40px; margin-bottom: 20px;">解析</h2>';
                newWindow.document.body.appendChild(analysisTitle);
                
                // 按顺序添加解析内容
                analysisContents.forEach((content, index) => {
                  // 添加分隔符（除了第一个元素）
                  if (index > 0) {
                    const separator = newWindow.document.createElement('div');
                    separator.innerHTML = '<hr style="margin: 20px 0; border: 1px solid #e0e0e0;">';
                    newWindow.document.body.appendChild(separator);
                  }
                  
                  // 创建解析内容容器
                  const analysisContainer = newWindow.document.createElement('div');
                  
                  // 添加顺序号
                  const orderNumber = newWindow.document.createElement('div');
                  orderNumber.innerHTML = `<h3 style="margin-bottom: 10px; font-size: 18px; font-weight: bold;">${index + 1}.</h3>`;
                  analysisContainer.appendChild(orderNumber);
                  
                  // 添加解析内容
                  const analysisContent = newWindow.document.createElement('div');
                  analysisContent.innerHTML = content;
                  analysisContainer.appendChild(analysisContent);
                  
                  // 添加到页面
                  newWindow.document.body.appendChild(analysisContainer);
                });
              }
            }
            
            // 删除seal-line内容
            const sealLineElements = newWindow.document.querySelectorAll('.seal-line');
            sealLineElements.forEach(element => {
              // 清空seal-line元素的内容
              element.innerHTML = '';
            });
            
            // 选择学生版时，删除exam-item__opt里的内容
            if (version === 'student') {
              const examItemOptElements = newWindow.document.querySelectorAll('.exam-item__opt');
              examItemOptElements.forEach(element => {
                // 清空exam-item__opt元素的内容
                element.innerHTML = '';
              });
            }
            
            // 删除empty-box group-exam-empty里的内容
            const emptyBoxElements = newWindow.document.querySelectorAll('.empty-box.group-exam-empty');
            emptyBoxElements.forEach(element => {
              // 清空empty-box group-exam-empty元素的内容
              element.innerHTML = '';
            });
            
            // 删除deleted-box里的内容
            const deletedBoxElements = newWindow.document.querySelectorAll('.deleted-box');
            deletedBoxElements.forEach(element => {
              // 清空deleted-box元素的内容
              element.innerHTML = '';
            });
            
            // 删除title为评分栏的table里的内容
            const scoreTableElements = newWindow.document.querySelectorAll('table[title="评分栏"]');
            scoreTableElements.forEach(element => {
              // 清空title为评分栏的table元素的内容
              element.innerHTML = '';
            });
            
            // 删除多个指定元素里的内容
            const elementsToClear = [
              '.secrecy-mark',
              '.paper-info',
              '.std-input',
              '.score-table',
              '.notice-box',
              '.exam-item__custom'
            ];
            
            elementsToClear.forEach(selector => {
              const elements = newWindow.document.querySelectorAll(selector);
              elements.forEach(element => {
                // 清空元素的内容
                element.innerHTML = '';
              });
            });
            

            
            // 检查页面中是否有包含mp3文件链接的<div class="audio">元素
            const audioElements = newWindow.document.querySelectorAll('.audio');
            const mp3Links = [];
            
            audioElements.forEach(element => {
              // 查找元素中的所有链接
              const links = element.querySelectorAll('a');
              links.forEach(link => {
                const href = link.getAttribute('href');
                if (href && href.toLowerCase().endsWith('.mp3')) {
                  mp3Links.push({
                    url: href,
                    text: link.textContent.trim() || '音频文件'
                  });
                }
              });
              
              // 查找元素中的所有音频元素
              const audioTags = element.querySelectorAll('audio');
              audioTags.forEach(audio => {
                const src = audio.getAttribute('src');
                if (src && src.toLowerCase().endsWith('.mp3')) {
                  mp3Links.push({
                    url: src,
                    text: '音频文件'
                  });
                }
              });
            });
            
            // 如果有mp3链接，添加下载音频按钮
            if (mp3Links.length > 0) {
              const topButtons = newWindow.document.querySelector('.top-buttons');
              if (topButtons) {
                const audioButton = newWindow.document.createElement('button');
                audioButton.className = 'audio-btn';
                audioButton.id = 'download-audio-btn';
                audioButton.textContent = '下载音频';
                audioButton.style.cssText = 'background-color: #ff9800; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;';
                
                // 添加点击事件
                audioButton.addEventListener('click', async function() {
                  // 顺序下载音频文件，每个间隔300毫秒
                  for (let i = 0; i < mp3Links.length; i++) {
                    const mp3 = mp3Links[i];
                    try {
                      // 使用fetch API获取音频文件
                      const response = await fetch(mp3.url);
                      if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                      }
                      
                      // 将响应转换为Blob
                      const blob = await response.blob();
                      
                      // 创建下载链接
                      const url = URL.createObjectURL(blob);
                      const link = newWindow.document.createElement('a');
                      link.href = url;
                      link.download = `audio_${i + 1}.mp3`;
                      link.style.display = 'none';
                      newWindow.document.body.appendChild(link);
                      link.click();
                      newWindow.document.body.removeChild(link);
                      
                      // 释放URL对象
                      setTimeout(() => URL.revokeObjectURL(url), 100);
                    } catch (error) {
                      console.error('下载音频失败:', error);
                      // 如果fetch失败，尝试使用原始方法
                      const link = newWindow.document.createElement('a');
                      link.href = mp3.url;
                      link.download = `audio_${i + 1}.mp3`;
                      link.target = '_blank';
                      link.style.display = 'none';
                      newWindow.document.body.appendChild(link);
                      link.click();
                      newWindow.document.body.removeChild(link);
                    }
                    
                    // 如果不是最后一个文件，添加300毫秒延迟
                    if (i < mp3Links.length - 1) {
                      await new Promise(resolve => setTimeout(resolve, 300));
                    }
                  }
                });
                
                topButtons.appendChild(audioButton);
              }
            }
            
            // 为每个.tk-quest-item.quesroot元素添加添加空行和删除空行按钮
            const questItemElements = newWindow.document.querySelectorAll('.tk-quest-item.quesroot');
            questItemElements.forEach((questItem, index) => {
              // 创建按钮容器
              const buttonContainer = newWindow.document.createElement('div');
              buttonContainer.style.cssText = 'margin: 10px 0; padding: 5px; border: 1px solid #ddd; background-color: #f9f9f9; display: flex; gap: 10px; opacity: 0; visibility: hidden; transition: opacity 0.3s, visibility 0.3s;';
              
              // 创建添加空行按钮
              const addEmptyLineButton = newWindow.document.createElement('button');
              addEmptyLineButton.textContent = '添加作答区';
              addEmptyLineButton.style.cssText = 'padding: 5px 10px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;';
              addEmptyLineButton.onclick = function(e) {
                e.stopPropagation();
                // 创建空行元素
                const emptyLine = newWindow.document.createElement('div');
                emptyLine.className = 'added-empty-line';
                emptyLine.style.cssText = 'height: 20px; margin: 5px 0;';
                // 添加到quest-item中
                questItem.appendChild(emptyLine);
              };
              
              // 创建删除空行按钮
              const removeEmptyLineButton = newWindow.document.createElement('button');
              removeEmptyLineButton.textContent = '删除作答区';
              removeEmptyLineButton.style.cssText = 'padding: 5px 10px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;';
              removeEmptyLineButton.onclick = function(e) {
                e.stopPropagation();
                // 查找并删除最后添加的空行
                const emptyLines = questItem.querySelectorAll('.added-empty-line');
                if (emptyLines.length > 0) {
                  emptyLines[emptyLines.length - 1].remove();
                }
              };
              
              // 将按钮添加到容器
              buttonContainer.appendChild(addEmptyLineButton);
              buttonContainer.appendChild(removeEmptyLineButton);
              
              // 为第一个题目项添加一键操作按钮
              if (index === 0) {
                // 创建一键添加作答区按钮
                const addAllAnswerButton = newWindow.document.createElement('button');
                addAllAnswerButton.textContent = '一键添加作答区';
                addAllAnswerButton.style.cssText = 'padding: 5px 10px; background-color: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;';
                addAllAnswerButton.onclick = function(e) {
                  e.stopPropagation();
                  // 触发所有添加作答区按钮
                  const addButtons = newWindow.document.querySelectorAll('button');
                  addButtons.forEach(button => {
                    if (button.textContent.includes('添加作答区')) {
                      button.click();
                    }
                  });
                };
                
                // 创建一键删除作答区按钮
                const removeAllAnswerButton = newWindow.document.createElement('button');
                removeAllAnswerButton.textContent = '一键删除作答区';
                removeAllAnswerButton.style.cssText = 'padding: 5px 10px; background-color: #9C27B0; color: white; border: none; border-radius: 4px; cursor: pointer;';
                removeAllAnswerButton.onclick = function(e) {
                  e.stopPropagation();
                  // 触发所有删除作答区按钮
                  const removeButtons = newWindow.document.querySelectorAll('button');
                  removeButtons.forEach(button => {
                    if (button.textContent.includes('删除作答区')) {
                      button.click();
                    }
                  });
                };
                
                // 将一键操作按钮添加到容器
                buttonContainer.appendChild(addAllAnswerButton);
                buttonContainer.appendChild(removeAllAnswerButton);
              }
              
              // 将按钮容器添加到quest-item的底部
              questItem.appendChild(buttonContainer);
              
              // 添加鼠标悬停事件
              questItem.addEventListener('mouseenter', function() {
                buttonContainer.style.opacity = '1';
                buttonContainer.style.visibility = 'visible';
              });
              
              questItem.addEventListener('mouseleave', function() {
                buttonContainer.style.opacity = '0';
                buttonContainer.style.visibility = 'hidden';
              });
            });
            
            // 为顶部的下载按钮添加点击事件
            const downloadWordBtn = newWindow.document.getElementById('download-word-btn');
            if (downloadWordBtn) {
              downloadWordBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                // 触发Word转换功能
                chrome.runtime.sendMessage({ action: 'convertPageToWord' }, function(response) {
                  if (response && response.success) {
                    // 创建下载链接
                    const link = newWindow.document.createElement('a');
                    link.href = response.dataUrl;
                    link.download = response.fileName;
                    newWindow.document.body.appendChild(link);
                    link.click();
                    newWindow.document.body.removeChild(link);
                  }
                });
              });
            }
            
            const downloadPdfBtn = newWindow.document.getElementById('download-pdf-btn');
            if (downloadPdfBtn) {
              downloadPdfBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                // 触发PDF打印功能
                newWindow.print();
              });
            }
            
            // 防重复点击标志
            let isProcessingClick = false;
            
            // 鼠标点击事件监听器，仅处理特定元素的点击，禁用左半边和右半边的点击功能
            newWindow.document.addEventListener('click', function(e) {
              // 阻止事件冒泡，防止多次触发
              e.stopPropagation();
              
              // 防重复点击
              if (isProcessingClick) {
                return;
              }
              
              // 检查点击目标是否为paper-title、pui_studentinput、pui_maintitle、title-txt元素，或具有特定样式的p元素，或它们的子元素
              const target = e.target;
              const isPaperTitle = target.classList.contains('paper-title') || target.closest('.paper-title');
              const isStudentInput = target.id === 'pui_studentinput' || target.closest('#pui_studentinput');
              const isMainTitle = target.id === 'pui_maintitle' || target.closest('#pui_maintitle');
              const isTitleTxt = target.classList.contains('title-txt') || target.closest('.title-txt');
              
              // 检查是否为具有特定样式的p元素
              let isSpecialPElement = false;
              let currentElement = target;
              while (currentElement) {
                if (currentElement.tagName === 'P') {
                  const lineHeight = currentElement.style.lineHeight;
                  const textAlign = currentElement.style.textAlign;
                  if (lineHeight === '19px' && textAlign === 'center') {
                    isSpecialPElement = true;
                    break;
                  }
                }
                currentElement = currentElement.parentElement;
              }
              
              // 仅处理特定元素的点击，禁用左半边和右半边的点击功能
              // 移除了根据点击位置触发不同功能的代码
            });
          });
        } else {
          // 向popup.js发送提示消息
          chrome.runtime.sendMessage({ action: 'networkStatus', message: '未找到指定的article.paper-cnt.clearfix元素' });
        }
      },
      args: [version, analysisLocation]
    });
  } catch (error) {
    console.error('执行提取试卷功能失败:', error);
  }
}

// 网页转Word功能实现
async function convertPageToWord(sendResponse) {
  try {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      sendResponse({ success: false, error: '无法获取当前标签页' });
      return;
    }
    
    // 向标签页注入html-docx-js库，然后获取页面内容并生成docx文档
    // 首先注入html-docx-js库
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['html-docx.js']
    });
    
    // 然后注入我们的转换脚本
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function() {
        // 删除页面中的添加作答区和删除作答区按钮
        function removeAnswerButtons() {
          // 获取所有按钮
          const allButtons = document.querySelectorAll('button');
          
          // 过滤并删除添加作答区按钮
          allButtons.forEach(button => {
            if (button.textContent.includes('添加作答区')) {
              button.remove();
            }
          });
          
          // 过滤并删除删除作答区按钮
          allButtons.forEach(button => {
            if (button.textContent.includes('删除作答区')) {
              button.remove();
            }
          });
          
          // 也删除按钮容器
          const buttonContainers = document.querySelectorAll('div[style*="opacity: 0"]');
          buttonContainers.forEach(container => {
            container.remove();
          });
        }
        

        
        // 获取页面内容
        function getPageContent() {
          // 删除添加作答区和删除作答区按钮
          removeAnswerButtons();
          
          // 获取页面标题
          const title = document.title || '无标题';
          
          // 获取主要内容
          let mainContent = document.querySelector('main') || 
                           document.querySelector('article') || 
                           document.querySelector('.content') || 
                           document.body;
          
          // 直接获取内容HTML
          let contentHtml = mainContent ? mainContent.innerHTML : document.body.innerHTML;
          
          // 生成Word文档内容
          const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <meta name="ProgId" content="Word.Document">
    <meta name="Generator" content="Microsoft Word 15">
    <meta name="Originator" content="Microsoft Word 15">
    <style>
        @page {
            margin: 1.27cm;
        }
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.5;
            margin: 20px;
        }
        h1, h2, h3, h4, h5, h6 {
            color: #333;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        p {
            margin-bottom: 15px;
        }
        img {
            max-width: 100%;
            height: auto;
            margin: 10px 0;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 10px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
        }
        ul, ol {
            margin-left: 20px;
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    ${contentHtml}
</body>
</html>
  `;
          
          return { html, title };
        }
        
        // 获取页面内容
        const { html, title } = getPageContent();
        
        // 生成文件名
        const fileName = `${title || '网页内容'}.docx`;
        
        // 尝试使用html-docx-js将HTML转换为docx格式
        try {
          // 检查htmlDocx是否可用
          if (typeof htmlDocx !== 'undefined') {
            const docx = htmlDocx.asBlob(html);
            
            // 将blob转换为base64
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = function() {
                const base64Data = reader.result.split(',')[1];
                resolve({ success: true, base64Data: base64Data, fileName: fileName });
              };
              reader.readAsDataURL(docx);
            });
          } else {
            return { success: false, error: 'html-docx-js库未加载' };
          }
        } catch (error) {
          return { success: false, error: error.message };
        }
      }
    });
    
    if (!result || !result[0] || !result[0].result) {
      sendResponse({ success: false, error: '无法获取页面内容' });
      return;
    }
    
    const scriptResult = result[0].result;
    
    if (!scriptResult.success) {
      sendResponse({ success: false, error: scriptResult.error });
      return;
    }
    
    // 生成data URL
    const dataUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${scriptResult.base64Data}`;
    
    // 返回数据给popup.js，由popup.js处理下载
    sendResponse({ success: true, dataUrl: dataUrl, fileName: scriptResult.fileName });
  } catch (error) {
    console.error('转换失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}


