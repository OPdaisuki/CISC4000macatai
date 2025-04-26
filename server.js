const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fetch = require('node-fetch');
const moment = require('moment');
const path = require('path');

const app = express();
const port = 3000;

// 修改静态文件中间件配置
app.use(cors({ origin: '*' })); // 临时允许所有跨域请求
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const config = {
  amapApiKey: process.env.AMAP_API_KEY,
  dbConfig: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  }
};
// 创建数据库连接池
const pool = mysql.createPool(config.dbConfig);

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
  console.log(`✅ 服务器已启动: http://localhost:3000`);
  console.log(`📂 静态文件目录: ${__dirname}`); // 显示根目录路径
});