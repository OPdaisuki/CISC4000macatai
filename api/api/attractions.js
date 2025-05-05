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
};
