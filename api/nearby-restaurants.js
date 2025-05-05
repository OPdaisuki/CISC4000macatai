const fetch = require('node-fetch');

const config = {
    amapApiKey: process.env.AMAP_API_KEY
};

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

module.exports = async (req, res) => {
    if (req.method!== 'GET') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

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
};
