const input = document.getElementById('inputText');
const results = document.getElementById('results');
const rawOutput = document.getElementById('rawOutput');
const toast = document.getElementById('toast');
let currentQuery = '';
let currentController = null;

// 中文检测
function hasChinese(str) { return /[\u4e00-\u9fa5]/.test(str); }
// 翻译 API
async function translateText(text) {
  if (currentController) {
    currentController.abort(); // 中断上一个请求
  }
  currentController = new AbortController();
  const signal = currentController.signal;

  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'loading';
  loadingDiv.textContent = '正在查询...';
  results.appendChild(loadingDiv);

  // Set a timeout to abort the request after 20 seconds
  const timeoutId = setTimeout(() => {
    currentController.abort(); // Abort the request if it takes too long
    if (loadingDiv.parentNode) {
      loadingDiv.textContent = '请求超时，请重试';
    }
  }, 20000); // 20 seconds timeout

  try {
    const proxyUrl = `https://quiet-morning-b82c.mkb900716.workers.dev/?q=${encodeURIComponent(text)}`;
    const res = await fetch(proxyUrl, { method: 'GET', headers: { 'Accept': 'application/json' }, signal });
    const data = await res.json();
    return data;
  } catch (e) {
    if (e.name === 'AbortError') return { result: null }; // 请求被中断
    return { result: null };
  } finally {
    clearTimeout(timeoutId); // Clear the timeout when the request completes or fails
    if (loadingDiv.parentNode) results.removeChild(loadingDiv); // Remove loading indicator
    currentController = null;
  }
}

// 清理输入
function cleanInput(str) { return str.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s_-]/g, ''); }

// 命名转换
function normalize(str) { str = str.replace(/([a-z])([A-Z])/g, '$1_$2'); str = str.replace(/[-\s]+/g, '_'); return str.toLowerCase().split('_').filter(Boolean); }
function toCamel(words) { return words.map((w, i) => i === 0 ? w : capitalize(w)).join(''); }
function toPascal(words) { return words.map(capitalize).join(''); }
function toSnake(words) { return words.join('_'); }
function toUpperSnake(words) { return words.join('_').toUpperCase(); }
function toKebab(words) { return words.join('-'); }
function capitalize(word) { return word.charAt(0).toUpperCase() + word.slice(1); }

// Toast
function showToast(msg) { toast.textContent = msg; toast.classList.add('show'); setTimeout(() => { toast.classList.remove('show'); }, 2000); }
function copyText(text) { navigator.clipboard.writeText(text).then(() => showToast('已复制: ' + text)); }

// 渲染格式
function renderFormats(str) {
  let formatDiv = results.querySelector('.formats-group');
  if (!formatDiv) {
    formatDiv = document.createElement('div');
    formatDiv.className = 'group formats-group';
    results.appendChild(formatDiv);
  }
  formatDiv.innerHTML = '';

  const words = normalize(str);
  const copyAllBtn = document.createElement('button');
  copyAllBtn.className = 'copy-all';
  copyAllBtn.textContent = '一键复制所有结果';
  copyAllBtn.onclick = () => {
    let all = formatDiv.querySelectorAll('.result .text');
    let text = '';
    all.forEach(el => { text += el.textContent.replace(/^[^:]+:\s/, '') + '\n'; });
    copyText(text);
  };
  formatDiv.appendChild(copyAllBtn);

  const groups = {
    '驼峰类': { 'camelCase': toCamel(words), 'PascalCase': toPascal(words) },
    '下划线类': { 'snake_case': toSnake(words), 'UPPER_SNAKE_CASE': toUpperSnake(words) },
    '短横线类': { 'kebab-case': toKebab(words) },
    '其他': { '首字母大写(Title Case)': words.map(capitalize).join(' ') }
  };

  Object.entries(groups).forEach(([groupName, formats]) => {
    const groupDiv = document.createElement('div'); groupDiv.className = 'group';
    const title = document.createElement('div'); title.className = 'group-title'; title.textContent = groupName;
    const content = document.createElement('div'); content.className = 'group-content';
    Object.entries(formats).forEach(([label, value]) => {
      const div = document.createElement('div'); div.className = 'result';
      div.innerHTML = `<div class="text"><strong>${label}:</strong> ${value}</div><button onclick="copyText('${value}')">复制</button>`;
      content.appendChild(div);
    });
    title.onclick = () => { content.style.maxHeight = content.style.maxHeight ? null : content.scrollHeight + 'px'; };
    groupDiv.appendChild(title);
    groupDiv.appendChild(content);
    formatDiv.appendChild(groupDiv);
  });
}

// 渲染翻译候选
async function renderResults(str) {
  str = cleanInput(str);
  if (!str) return;

  const isNewQuery = str !== currentQuery;
  results.innerHTML = '';
  rawOutput.innerHTML = '';
  currentQuery = str;

  if (hasChinese(str)) {
    const data = await translateText(str);

    if (!data?.result?.payload) {
      const pre = document.createElement('div');
      pre.innerHTML = `${data?.result?.payload}`;
      rawOutput.appendChild(pre);
      return;
    }

    if (Array.isArray(data?.result?.dics)) {
      let tDiv = results.querySelector('.translations-group');
      if (!tDiv) {
        tDiv = document.createElement('div');
        tDiv.className = 'group translations-group';
        const title = document.createElement('div');
        title.className = 'group-title';
        title.textContent = '翻译候选（点击选择）';
        const wrap = document.createElement('div');
        wrap.className = 'translations';
        tDiv.appendChild(title);
        tDiv.appendChild(wrap);
        rawOutput.appendChild(tDiv);
      }
      const wrap = tDiv.querySelector('.translations');
      wrap.innerHTML = '';
      (data?.result?.dics || []).forEach(opt => {
        const item = document.createElement('div');
        item.className = 'translation-item';
        item.textContent = opt;

        // Click event to select translation
        item.onclick = () => {
          wrap.querySelectorAll('.translation-item').forEach(el => el.classList.remove('active'));
          item.classList.add('active');
          renderFormats(opt);
        };

        // Double-click event to copy the translation text
        item.ondblclick = () => {
          copyText(item.textContent);
        };

        wrap.appendChild(item);
      });
    }

    const pre = document.createElement('div');
    pre.innerHTML = `${data?.result?.payload}`;
    rawOutput.appendChild(pre);

  } else {
    renderFormats(str);
  }
}


// 防抖输入监听
let debounceTimer;
input.addEventListener('input', e => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => renderResults(e.target.value), 800);
});