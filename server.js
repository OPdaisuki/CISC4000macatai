const express = require('express');
const cors = require('cors');
//const mysql = require('mysql2/promise');
const fetch = require('node-fetch');
const moment = require('moment');
const path = require('path');

const app = express();
// 从环境变量中获取端口号，如果没有则使用默认值 3000
const port = process.env.PORT || 3000;

// 修改静态文件中间件配置
// server.js 修改中间件顺序
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/api', require('./dst_api_service')); // 添加API路由
app.use(express.static(path.join(__dirname, 'public')));

// 在所有路由后添加错误处理中间件
app.use((err, req, res, next) => {
  console.error('全局错误:', err.stack);
  res.status(500).json({ error: '内部服务器错误' });
});

/*const config = {
  amapApiKey: process.env.AMAP_API_KEY,
  dbConfig: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  }
};*/
// 创建数据库连接池
//const pool = mysql.createPool(config.dbConfig);

// 从环境变量中获取 API Key
const apiKey = process.env.SILICONFLOW_API_KEY;

// server.js 新增以下内容
app.get('/api/get-key', (req, res) => {
  if (!apiKey) {
    return res.status(500).json({ error: 'API密钥未配置' });
  }
  res.json({ apiKey });
});

// 高德地图API请求函数
async function fetchAmapData(url, params) {
  try {
    const query = new URLSearchParams({ ...params, key: config.amapApiKey });
    const response = await fetch(`${url}?${query}`);
    
    if (!response.ok) throw new Error(`API请求失败: ${response.statusText}`);
    
    return response.json();
  } catch (error) {
    console.error('API请求错误:', error);
    return null;
  }
}

// 景点数据接口
app.get('/api/attractions', async (req, res) => {
  try {
    const data = await fetchAmapData('https://restapi.amap.com/v3/place/text', {
      keywords: '澳门旅游景点',
      city: '澳门',
      offset: 20,
      page: 1
    });

    if (!data.pois) throw new Error('无有效景点数据');
    
    const processedData = data.pois.map(poi => ({
      id: poi.id,
      name: poi.name,
      address: poi.address,
      longitude: poi.location.split(',')[0],
      latitude: poi.location.split(',')[1]
    }));

    res.json(processedData);
  } catch (error) {
    console.error('景点数据获取失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 周边餐厅接口
app.get('/api/nearby-restaurants', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const data = await fetchAmapData('https://restapi.amap.com/v3/place/around', {
      location: `${lng},${lat}`,
      keywords: '饭店',
      radius: 500,
      offset: 10
    });

    res.json(data.pois.map(poi => ({
      name: poi.name,
      address: poi.address,
      distance: poi.distance
    })));
  } catch (error) {
    console.error('餐厅数据获取失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
    console.log(`✅ 服务器已启动: http://localhost:${port}`);
    console.log(`📂 静态文件目录: ${__dirname}`); 
});
