
// 监听来自popup.js的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extractPaper') {
    // 执行差异化处理和提取试卷功能
    executeExtractPaper(message.tabId, message.version, message.analysisLocation, message.paperSize);
    sendResponse({ success: true });
  } else if (message.action === 'convertPageToWord') {
    // 执行网页转Word功能
    convertPageToWord(message, sendResponse);
    return true; // 表示会异步发送响应
  } else if (message.action === 'fetchImageDataUrl') {
    // 按需拉取单张图片转 dataURL，供导出页内联
    fetchImageDataUrl(message.url).then(sendResponse);
    return true; // 表示会异步发送响应
  }
});


// 解析元素选择器列表（差异化处理与提取后状态恢复共用同一份，保证两次注入收集顺序一致）
const ANALYSIS_SELECTORS = [
  '.exam-item__analysis',
  '.analysis',
  '.解析',
  '[class*="analysis"]',
  '[class*="解析"]',
  '[id*="analysis"]',
  '[id*="解析"]'
];

// 执行差异化处理和提取试卷功能
async function executeExtractPaper(tabId, version, analysisLocation, paperSize) {
  // 差异化处理后额外等待页面稳定的时长
  const EXTRACT_STABLE_MS = 500;
  try {
    // 执行差异化处理
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (version, analysisLocation, analysisSelectors) => {
        return new Promise(resolve => {
          const currentUrl = window.location.href;

          // 差异化处理逻辑
          if (currentUrl.includes('zujuan.xkw.com')) {
            // 获取所有可能的解析元素
            let analysisElements = [];
            analysisSelectors.forEach(selector => {
              const elements = document.querySelectorAll(selector);
              analysisElements = [...analysisElements, ...elements];
            });

            // 去重
            analysisElements = [...new Set(analysisElements)];

            // 备份原页面解析显示状态，提取完成后由恢复脚本还原
            const optLookup = (cnt) => cnt.closest('.exam-item')?.querySelector('.exam-item__opt')
              || cnt.parentElement?.querySelector('.exam-item__opt')
              || cnt.parentElement?.parentElement?.querySelector('.exam-item__opt');
            window.__paperExtractBackup = {
              analyses: analysisElements.map(el => ({
                display: el.style.display || '',
                visibility: el.style.visibility || '',
                hidden: el.getAttribute('hidden'),
                className: el.getAttribute('class')
              })),
              opts: Array.from(document.querySelectorAll('.exam-item__cnt')).map(cnt => {
                const opt = optLookup(cnt);
                return opt ? {
                  optHidden: opt.hasAttribute('hidden') || opt.style.display === 'none' || opt.style.visibility === 'hidden'
                } : null;
              })
            };

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
          
          // 等待一段时间确保点击操作完全完成
          const CLICK_SETTLE_MS = 666;
          setTimeout(() => {
            resolve();
          }, CLICK_SETTLE_MS);
        });
      },
      args: [version, analysisLocation, ANALYSIS_SELECTORS]
    });

    // 额外添加延迟，确保页面完全稳定
    await new Promise(resolve => setTimeout(resolve, EXTRACT_STABLE_MS));
    
    // 执行提取试卷功能
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (version, analysisLocation, paperSize) => {
        // 获取当前页面URL
        const currentUrl = window.location.href;
        let contentElement = null;

        // HTML 转义（试卷标题可能含 < > & 等字符）
        function escapeHtml(value) {
          return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }
        
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
          ['.ques-ctrl.clearfix', '.btn-box.clearfix', '.ctrl-box', '.exam-item__info.clearfix', '.top-msg', '.msg-box', '.info-list']
            .forEach(selector => doc.querySelectorAll(selector).forEach(element => element.remove()));
          
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
              <title>${escapeHtml(titleWithVersion)}</title>
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
                <button class="word-btn" id="download-word-btn">导出Word</button>
                <button class="pdf-btn" id="download-pdf-btn">下载PDF</button>
              </div>
              
              ${processedArticleHtml}
            </body>
            </html>
          `);
          
          newWindow.document.close();

          // 记录导出纸张类型，供后台转换 Word 时读取
          newWindow.document.documentElement.setAttribute('data-paper-size', paperSize || 'a4');
          
          // 文档加载完成后添加点击事件监听器
          newWindow.addEventListener('load', function() {
            // 确保paper-title元素可编辑
            const paperTitleElements = newWindow.document.querySelectorAll('.paper-title');
            paperTitleElements.forEach(element => {
              element.contentEditable = 'true';
              element.style.pointerEvents = 'auto';
              element.style.userSelect = 'auto';
              element.setAttribute('contenteditable', 'true');
            });
            
            // 确保pui_studentinput元素可编辑并居中显示
            const studentInputElement = newWindow.document.getElementById('pui_studentinput');
            if (studentInputElement) {
              studentInputElement.contentEditable = 'true';
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
            
            // 选择学生版时，清空exam-item__opt里的解析内容
            if (version === 'student') {
              newWindow.document.querySelectorAll('.exam-item__opt').forEach(element => {
                element.innerHTML = '';
              });
            }

            // 清空指定元素的内容
            ['.seal-line', '.empty-box.group-exam-empty', '.deleted-box', 'table[title="评分栏"]',
              '.secrecy-mark', '.paper-info', '.std-input', '.score-table', '.notice-box', '.exam-item__custom']
              .forEach(selector => newWindow.document.querySelectorAll(selector).forEach(element => {
                element.innerHTML = '';
              }));
            

            
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
                // 触发Word转换功能（文件由后台注入的脚本在本页面内直接触发下载）
                const originalText = downloadWordBtn.textContent;
                downloadWordBtn.textContent = '导出中…';
                downloadWordBtn.disabled = true;
                chrome.runtime.sendMessage({ action: 'convertPageToWord' }, function(response) {
                  downloadWordBtn.disabled = false;
                  if (chrome.runtime.lastError || !response || !response.success) {
                    const err = (chrome.runtime.lastError && chrome.runtime.lastError.message)
                      || (response && response.error) || '未知错误';
                    downloadWordBtn.textContent = originalText;
                    alert('导出Word失败：' + err);
                    return;
                  }
                  downloadWordBtn.textContent = '✓ 已导出';
                  setTimeout(function() { downloadWordBtn.textContent = originalText; }, 3000);
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
          });
        } else {
          // 向popup.js发送提示消息
          chrome.runtime.sendMessage({ action: 'networkStatus', message: '未找到指定的article.paper-cnt.clearfix元素' });
        }
      },
      args: [version, analysisLocation, paperSize]
    });

    // 提取完成后，恢复原页面的解析显示状态（还原差异化处理的改动）
    await restorePageAnalysisState(tabId);
  } catch (error) {
    console.error('执行提取试卷功能失败:', error);
    // 失败时通过消息通道通知 popup 显示错误
    chrome.runtime.sendMessage({ action: 'networkStatus', message: `提取失败：${error.message || error}` }).catch(() => {});
  }
}

// 提取完成后恢复原页面状态：还原被改动的解析元素样式，把被点击翻转的解析显隐再点回去
async function restorePageAnalysisState(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (analysisSelectors) => {
        const backup = window.__paperExtractBackup;
        if (!backup) return;
        delete window.__paperExtractBackup;

        // 与差异化处理时相同的选择器顺序，保证按索引对位还原
        let analysisElements = [];
        analysisSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          analysisElements = [...analysisElements, ...elements];
        });
        analysisElements = [...new Set(analysisElements)];

        analysisElements.forEach((el, i) => {
          const snap = backup.analyses[i];
          if (!snap) return;
          el.style.display = snap.display;
          el.style.visibility = snap.visibility;
          if (snap.hidden === null) {
            el.removeAttribute('hidden');
          } else {
            el.setAttribute('hidden', snap.hidden);
          }
          if (snap.className === null) {
            el.removeAttribute('class');
          } else {
            el.setAttribute('class', snap.className);
          }
        });

        // 解析显隐被点击翻转的题目，再点一次复原
        const optLookup = (cnt) => cnt.closest('.exam-item')?.querySelector('.exam-item__opt')
          || cnt.parentElement?.querySelector('.exam-item__opt')
          || cnt.parentElement?.parentElement?.querySelector('.exam-item__opt');
        const cntElements = document.querySelectorAll('.exam-item__cnt');
        cntElements.forEach((cnt, i) => {
          const snap = backup.opts[i];
          if (!snap) return;
          const opt = optLookup(cnt);
          if (!opt) return;
          const nowHidden = opt.hasAttribute('hidden') || opt.style.display === 'none' || opt.style.visibility === 'hidden';
          if (nowHidden !== snap.optHidden) {
            cnt.click();
          }
        });
      },
      args: [ANALYSIS_SELECTORS]
    });
  } catch (error) {
    console.error('恢复原页面状态失败:', error);
  }
}

// 把 ArrayBuffer 转成 base64（Service Worker 里没有 FileReader）
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// 拉取单张图片转 dataURL。带 8 秒超时，防止单张图片连接停滞拖死整个导出
async function fetchImageDataUrl(url) {
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: '非 http(s) 链接' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(url, { credentials: 'omit', signal: controller.signal });
    if (!resp.ok) return { ok: false, error: 'HTTP ' + resp.status };
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > 8 * 1024 * 1024) return { ok: false, error: '图片超过 8MB' };
    const type = resp.headers.get('content-type') || 'image/png';
    return { ok: true, dataUrl: `data:${type};base64,${arrayBufferToBase64(buf)}` };
  } catch (e) {
    return { ok: false, error: e && e.name === 'AbortError' ? '拉取超时' : String((e && e.message) || e) };
  } finally {
    clearTimeout(timer);
  }
}

// 网页转Word功能实现
async function convertPageToWord(message, sendResponse) {
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
      func: async function(paperSize) {
        // 纸张类型：popup 传入优先，其次读预览页记录。A4 纵向正文宽 ≈697px；B4 横向（8开）≈1280px
        const paper = (paperSize || document.documentElement.getAttribute('data-paper-size') || 'a4').toLowerCase();
        const WORD_CONTENT_WIDTH = paper === 'b4' ? 1280 : 697;

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
        

        
        // ==== 集成 MS优化.bas 排版宏 ====
        // ① 表格可打印边框置空（屏幕上靠 Word 的"查看网格线"虚框看结构）
        // ② 全部表格宽度 100%，列宽按原比例折算成百分比，防止固定列宽撑出页面
        // ③ 超宽图片等比缩小：表格内以"单元格宽-2pt"为上限，表格外以正文宽为上限
        function applyMsOptimizations() {
          const MAX_IMG_WIDTH = WORD_CONTENT_WIDTH - 7; // 表格外图片上限，留 7px 余量
          const CELL_MARGIN = 3;          // 单元格内边距余量，约等于宏里的 2pt

          // Word 实际生效的图片宽度：width 属性 > 内联样式(px) > 固有宽度。
          // 预览页的站点 CSS 不会进入导出的 docx，不能按屏幕显示宽度判断是否超宽
          function wordVisibleWidth(img) {
            const attrW = parseInt(img.getAttribute('width'), 10);
            if (!isNaN(attrW) && attrW > 0) return attrW;
            const match = /([\d.]+)px/.exec(img.style.width || '');
            if (match) return parseFloat(match[1]);
            return img.naturalWidth || 0;
          }

          // 先快照尺寸再改样式，避免改动后的布局污染后续测量
          const tableSnapshots = Array.from(document.querySelectorAll('table')).map(tbl => {
            const tableWidth = tbl.getBoundingClientRect().width;
            // 该表在 Word 里约占满 697px 正文宽，用于把单元格宽投影到 Word 页面
            const wordScale = tableWidth > 0 ? WORD_CONTENT_WIDTH / tableWidth : 1;
            return {
              tbl: tbl,
              tableWidth: tableWidth,
              wordScale: wordScale,
              cells: Array.from(tbl.querySelectorAll('td,th')).map(cell => ({
                cell: cell,
                width: cell.getBoundingClientRect().width
              })),
              imgs: Array.from(tbl.querySelectorAll('img')).map(img => {
                const cell = img.closest('td,th');
                return {
                  img: img,
                  width: wordVisibleWidth(img),
                  cellWidth: cell ? cell.getBoundingClientRect().width : 0
                };
              })
            };
          });

          tableSnapshots.forEach(snap => {
            const tbl = snap.tbl;

            // ② 表格宽度 100%，并去掉边框类属性
            tbl.removeAttribute('width');
            tbl.removeAttribute('border');
            tbl.removeAttribute('cellspacing');
            tbl.removeAttribute('frame');
            tbl.removeAttribute('rules');
            tbl.style.width = '100%';
            tbl.style.border = 'none'; // ① 可打印边框置空

            // 列宽折算成百分比：固定像素列宽在 Word 里会把表格撑出页面
            snap.cells.forEach(item => {
              if (snap.tableWidth > 0 && item.width > 0) {
                item.cell.style.width = (item.width / snap.tableWidth * 100).toFixed(2) + '%';
              }
              item.cell.removeAttribute('width');
              item.cell.style.border = 'none';
            });

            // ③ 表格内图片：以"Word 单元格宽 - 2pt"为上限，用百分比宽度自适应
            snap.imgs.forEach(item => {
              if (item.cellWidth <= 0) return;
              const wordCellWidth = item.cellWidth * snap.wordScale;
              if (item.width > wordCellWidth - CELL_MARGIN) {
                item.img.style.width = ((wordCellWidth - CELL_MARGIN) / wordCellWidth * 100).toFixed(1) + '%';
                item.img.style.height = 'auto';
                item.img.removeAttribute('height');
              }
            });
          });

          // ③ 表格外图片：上限为 Word 正文宽度
          Array.from(document.querySelectorAll('img')).forEach(img => {
            if (img.closest('td,th')) return;
            if (wordVisibleWidth(img) > MAX_IMG_WIDTH) {
              img.style.width = MAX_IMG_WIDTH + 'px';
              img.style.height = 'auto';
              img.removeAttribute('height');
            }
          });
        }

        // 通过后台按需拉取图片并内联为 dataURL（单张超时/失败仅保留远程链接，不阻塞导出）
        function inlineImagesViaBackground() {
          const imgs = Array.from(document.querySelectorAll('img')).filter(img => /^https?:\/\//i.test(img.src));
          return Promise.all(imgs.map(img =>
            new Promise(resolve => {
              let settled = false;
              const finish = () => { if (!settled) { settled = true; resolve(); } };
              try {
                chrome.runtime.sendMessage({ action: 'fetchImageDataUrl', url: img.src }, resp => {
                  void chrome.runtime.lastError; // 后台无响应时忽略，保留远程链接
                  if (resp && resp.ok) {
                    img.src = resp.dataUrl;
                    img.removeAttribute('srcset');
                  }
                  finish();
                });
                setTimeout(finish, 12000); // 消息通道兜底超时
              } catch (e) {
                finish();
              }
            })
          ));
        }

        // 获取页面内容
        async function getPageContent() {
          // 删除添加作答区和删除作答区按钮
          removeAnswerButtons();

          // 移除预览页顶部的悬浮按钮栏，避免混入导出内容
          const topButtonsBar = document.querySelector('.top-buttons');
          if (topButtonsBar) topButtonsBar.remove();

          // 图片内联为 dataURL，导出的文档不再依赖远程图链
          await inlineImagesViaBackground();

          // 内容里已有试卷标题元素时不再重复输出 h1 标题
          const hasInContentTitle = !!document.querySelector('.title-txt, .paper-title, #pui_maintitle');

          // HTML 转义
          function escapeHtml(value) {
            return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          }

          // 应用 MS优化.bas 的排版逻辑
          applyMsOptimizations();

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
    <title>${escapeHtml(title)}</title>
    <meta name="ProgId" content="Word.Document">
    <meta name="Generator" content="Microsoft Word 15">
    <meta name="Originator" content="Microsoft Word 15">
    <style>
        @page {
            size: ${paper === 'b4' ? 'B4 landscape' : 'A4 portrait'};
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
            padding: 8px;
            text-align: left;
        }
        ul, ol {
            margin-left: 20px;
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    ${hasInContentTitle ? '' : `<h1>${escapeHtml(title)}</h1>`}
    ${contentHtml}
</body>
</html>
  `;
          
          return { html, title };
        }
        
        // 获取页面内容
        const { html, title } = await getPageContent();
        
        // 生成文件名
        const fileName = `${title || '网页内容'}.docx`;
        
        // 尝试使用html-docx-js将HTML转换为docx格式
        try {
          // 检查htmlDocx是否可用
          if (typeof htmlDocx !== 'undefined') {
            const docx = htmlDocx.asBlob(html);

            // 直接在本页面内触发下载，避免整个文件 base64 回传
            const link = document.createElement('a');
            link.href = URL.createObjectURL(docx);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(link.href), 10000);

            return { success: true, fileName: fileName };
          } else {
            return { success: false, error: 'html-docx-js库未加载' };
          }
        } catch (error) {
          return { success: false, error: error.message };
        }
      },
      args: [message.paperSize || null]
    });
    
    if (!result || !result[0] || !result[0].result) {
      sendResponse({ success: false, error: '无法获取页面内容' });
      return;
    }

    // 文件已在页面内触发下载，仅向调用方回传结果状态
    sendResponse(result[0].result);
  } catch (error) {
    console.error('转换失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}


