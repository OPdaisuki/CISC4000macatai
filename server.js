const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// ========== 中间件配置 ==========
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// 严格跨域配置（允许前端域名）
const allowedOrigins = ['https://cisc-4000macatai.vercel.app', 'http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('跨域请求被拒绝'));
    }
  }
}));

app.use(express.json()); // JSON 解析中间件

// ========== API 路由配置（必须在静态文件之前）==========
// 1. 调试接口（验证环境变量）
app.get('/api/debug', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    envCheck: {
      nodeEnv: process.env.NODE_ENV,
      apiKeyExists: !!process.env.SILICONFLOW_API_KEY
    }
  });
});

// 2. 获取 API 密钥接口（核心修正点：确保返回 JSON）
app.get('/api/get-key', (req, res) => {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    console.error('[SERVER] 环境变量未加载: SILICONFLOW_API_KEY');
    return res.status(500).json({ // 显式返回 JSON 错误
      error: '服务器配置错误，API 密钥未设置',
      details: '请检查环境变量 SILICONFLOW_API_KEY'
    });
  }
  res.json({ apiKey }); // 正确返回 JSON 格式密钥
});

// 3. 其他业务路由（示例）
// app.use('/api/attractions', require('./routes/attractions'));
// app.use('/api/restaurants', require('./routes/restaurants'));

// ========== 静态文件中间件（移到所有 API 路由之后！核心修正点）==========
app.use(express.static(path.join(__dirname, 'public'))); // 静态文件处理放在最后

// ========== 错误处理中间件 ==========
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack);
  res.status(500).json({ // 统一返回 JSON 错误
    error: '内部服务器错误',
    details: err.message
  });
});

app.listen(port, () => {
  console.log(`✅ 服务器运行中: http://localhost:${port}`);
  console.log(`🔍 调试接口: http://localhost:${port}/api/debug`);
});
