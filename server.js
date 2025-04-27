// 在server.js顶部添加检查
console.log('环境变量检查:', {
  NODE_ENV: process.env.NODE_ENV,
  API_KEY_LOADED: !!process.env.SILICONFLOW_API_KEY
});

// server.js 中间件和路由的正确顺序
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// ========== 中间件配置 ==========
app.use(cors({ origin: '*' }));      // 1. 跨域处理
app.use(express.json());             // 2. JSON解析

// 在server.js中添加调试中间件
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ========== API路由配置 ==========
// 3. 硅基流动API密钥接口
app.get('/api/get-key', (req, res) => {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    console.error('[SERVER] 环境变量未加载: SILICONFLOW_API_KEY');
    return res.status(500).json({ error: '服务器配置错误' });
  }
  res.json({ apiKey });
});

// 4. 其他API路由（示例）
app.use('/api/attractions', require('./routes/attractions'));
app.use('/api/restaurants', require('./routes/restaurants'));

// ========== 静态文件中间件 ==========
// 5. 必须放在所有API路由之后！
app.use(express.static(path.join(__dirname, 'public'))); 

// ========== 错误处理 ==========
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack);
  res.status(500).json({ error: '内部服务器错误' });
});

app.listen(port, () => {
  console.log(`✅ 服务器运行中: http://localhost:${port}`);
});
