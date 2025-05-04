// 硅基流动 API Key
//const apiKey = process.env.SILICONFLOW_API_KEY; // 由 Render 环境变量注入
const apiKey = 'sk-ttlofmqnslochyllznmkmbmqocnybibwuojlkdlimmeptpcc';
const apiUrl = 'https://api.siliconflow.cn/v1/chat/completions';
// 修改为 ES6 模块导入语法
import { searchRag } from './rag.js';

// 存储 CSV 文件内容（增强版含地址）
let diningData = [];
let scenicData = [];
let accommodationData = [];
let conversationHistory = [];

// 增强版 CSV 解析（支持名称+地址）
async function loadCSVData() {
    try {
        // 解析餐饮数据（假设CSV格式：名称,地址,...）
        const diningResponse = await fetch('./data/dataPOI_820000_餐饮服务.csv');
        const diningText = await diningResponse.text();
        const diningLines = diningText.split('\n');
        for (let i = 1; i < diningLines.length; i++) {
            const columns = diningLines[i].split(',');
            if (columns.length >= 2) { // 至少包含名称和地址
                diningData.push({
                    name: columns[0].trim(),
                    address: columns[1].trim()
                });
            }
        }

        // 解析风景名胜数据
        const scenicResponse = await fetch('./data/dataPOI_820000_风景名胜.csv');
        const scenicText = await scenicResponse.text();
        const scenicLines = scenicText.split('\n');
        for (let i = 1; i < scenicLines.length; i++) {
            const columns = scenicLines[i].split(',');
            if (columns.length >= 2) {
                scenicData.push({
                    name: columns[0].trim(),
                    address: columns[1].trim()
                });
            }
        }

        // 解析住宿数据
        const accommodationResponse = await fetch('./data/dataPOI_820000_住宿服务.csv');
        const accommodationText = await accommodationResponse.text();
        const accommodationLines = accommodationText.split('\n');
        for (let i = 1; i < accommodationLines.length; i++) {
            const columns = accommodationLines[i].split(',');
            if (columns.length >= 2) {
                accommodationData.push({
                    name: columns[0].trim(),
                    address: columns[1].trim()
                });
            }
        }
    } catch (error) {
        console.error('CSV 数据加载失败:', error);
    }
}

// 支持换行和滚动优化的消息展示
function appendMessage(type, sender, content) {
    const chatBox = document.getElementById('chat-box');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;

    const senderSpan = document.createElement('span');
    senderSpan.className = 'sender';
    senderSpan.textContent = `${sender}: `;
    messageDiv.appendChild(senderSpan);

    const contentSpan = document.createElement('span');
    contentSpan.className = 'content';
    contentSpan.innerHTML = content.replace(/\n/g, '<br>');
    messageDiv.appendChild(contentSpan);

    chatBox.appendChild(messageDiv);
    // 滚动到底部时保持平滑
    chatBox.scrollTo({
        top: chatBox.scrollHeight,
        behavior: 'smooth'
    });
    return messageDiv;
}

// 集成公交路线生成的发送函数
async function sendMessage() {
    const userInput = document.getElementById('user-input');
    const message = userInput.value.trim();
    if (!message) return;

    // 显示用户消息
    appendMessage('user-message', '您', message);
    userInput.value = '';
    conversationHistory.push({ role: 'user', content: message });

    try {
        const relevantChunks = await searchRag(message, 3); // 获取前 3 个相关数据块
        const context = relevantChunks.map(chunk => chunk.text).join('\n');
        const loadingMsg = appendMessage('ai-message loading', 'AI助手', '正在规划路线... ⌛');

        // 生成公交路线指引模板
        const busGuidelines = `澳门公交参考：
        - 历史城区（大三巴/议事亭）：3、3X、6A、26A 路
        - 路氹酒店区：25B、26、MT4 路 + 免费接驳车
        - 机场/码头：AP1、AP1X 路
        - 夜间路线：N1A、N3 路
        注：酒店接驳车通常免费且班次密集`;

        const options = {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'Pro/deepseek-ai/DeepSeek-R1',
                messages: [
                    {
                        role: 'system',
                        content: `作为澳门旅游专家，请严格按此流程响应：
                        1. 必打卡景点（从以下选择）：${scenicData.map(x => x.name).join(', ')}
                          格式：
                          - 名称：{名称}
                          - 特色：{15字内亮点}
                          - 地址：{精确地址}
                          - 交通：{根据地址生成的公交路线}
                          - 推荐：{评分+优势}

                        2. 亲子娱乐（从娱乐场所选择）
                          格式同上

                        3. 附近住宿（从以下推荐）：${accommodationData.map(x => x.name).join(', ')}
                          - 名称：{酒店}（地址：{地址}）
                          - 交通：{公交/接驳车建议}

                        4. 附近餐饮（从以下推荐）：${diningData.map(x => x.name).join(', ')}
                          - 名称：{餐厅}（地址：{地址}）
                          - 交通：{步行/公交指引}

                        公交生成规则：
                        ${busGuidelines}
                        
                        要求：
                        • 使用口语化中文，避免专业术语
                        • 每个推荐必须包含交通信息
                        • 地址必须来自用户提供的数据`
                    },
                    ...conversationHistory
                ],
                stream: true,
                max_tokens: 4096,
                temperature: 0.65,
                top_p: 0.85
            })
        };

        const response = await fetch(apiUrl, options);
        if (!response.ok) throw new Error(`请求失败: ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let completeReply = '';
        loadingMsg.remove();

        const aiMessageDiv = appendMessage('ai-message', 'AI助手', '');
        const contentSpan = aiMessageDiv.querySelector('.content');

        // 获取 chat-box 元素
        const chatBox = document.getElementById('chat-box');

        let buffer = ''; // 新增缓冲区，用于拼接数据
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk; // 将新数据追加到缓冲区

            const lines = buffer.split('\n').filter(l => l.trim());
            buffer = lines.pop() || ''; // 保留未完整的行到缓冲区

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') break;

                    try {
                        const jsonData = JSON.parse(data);
                        const delta = jsonData.choices[0]?.delta?.content || '';
                        completeReply += delta;
                        contentSpan.innerHTML = completeReply
                           .replace(/\n/g, '<br>')
                           .replace(/(路氹|度假区)/g, '<strong>$1</strong>'); // 关键地点高亮
                        chatBox.scrollTop = chatBox.scrollHeight;
                    } catch (e) {
                        console.warn('流数据解析异常:', e);
                    }
                }
            }
        }

        conversationHistory.push({ role: 'assistant', content: completeReply });

    } catch (error) {
        console.error('请求异常:', error);
        appendMessage('system-message', '系统', '服务繁忙，请稍后重试 ⚠️');
    }
}

// 完整页面初始化逻辑
document.addEventListener('DOMContentLoaded', async () => {
    // 用户交互组件
    const authModal = document.getElementById('authModal');
    const loginButton = document.getElementById('loginButton');
    const closeModal = document.querySelector('.close');
    const switchAuth = document.getElementById('switchAuth');
    const authForm = document.getElementById('authForm');
    const modalTitle = document.getElementById('modalTitle');
    const submitAuth = document.getElementById('submitAuth');

    // 检查元素是否存在
    if (!authModal || !loginButton || !closeModal || !switchAuth || !authForm || !modalTitle || !submitAuth) {
        console.error('部分认证相关元素未找到，请检查 HTML 结构。');
        return;
    }

    // 登录/注册切换
    loginButton.addEventListener('click', () => authModal.style.display = 'block');
    closeModal.addEventListener('click', () => authModal.style.display = 'none');
    window.addEventListener('click', (e) => e.target === authModal && (authModal.style.display = 'none'));

    // 切换表单类型
    switchAuth.addEventListener('click', () => {
        const isLogin = modalTitle.textContent === '登录';
        modalTitle.textContent = isLogin ? '注册' : '登录';
        switchAuth.textContent = isLogin ? '切换到登录' : '切换到注册';
        submitAuth.textContent = isLogin ? '注册' : '登录';
    });

    // 表单提交
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username');
        const password = document.getElementById('password');

        // 检查输入元素是否存在
        if (!username || !password) {
            console.error('用户名或密码输入元素未找到，请检查 HTML 结构。');
            return;
        }

        const isRegister = modalTitle.textContent === '注册';

        try {
            const response = await fetch(isRegister ? '/register' : '/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.value, password: password.value })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            alert(data.success ? (isRegister ? '注册成功!' : '登录成功!') : data.message);
            data.success && (authModal.style.display = 'none');
        } catch (error) {
            console.error('认证失败:', error);
            alert('网络异常，请检查连接');
        }
    });

    // 功能绑定
    const backButton = document.getElementById('backButton');
    const sendButton = document.getElementById('sendButton');
    const userInput = document.getElementById('user-input');

    // 检查按钮和输入框是否存在
    if (!backButton || !sendButton || !userInput) {
        console.error('部分功能按钮或输入框未找到，请检查 HTML 结构。');
        return;
    }

    backButton.addEventListener('click', () => window.location.href = 'Mainpage.html');
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => e.key === 'Enter' && sendMessage());

    // 初始化数据
    loadCSVData();
});
