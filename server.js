const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const moment = require('moment');
const path = require('path');
const fs = require('fs');
const xml2js = require('xml2js');
const Excel = require('exceljs');
const { pipeline } = require('@xenova/transformers');
const faiss = require('faiss-node');

const app = express();
const port = 3000;

let model;
let index;
let chunks = [];

// XML解析函数
function parseXml(xmlPath) {
    return new Promise((resolve, reject) => {
        fs.readFile(xmlPath, 'utf8', (err, data) => {
            if (err) {
                console.error('XML读取错误:', err);
                resolve([]);
                return;
            }
            xml2js.parseString(data, (err, result) => {
                if (err) {
                    console.error('XML解析错误:', err);
                    resolve([]);
                    return;
                }
                const hotels = result.mgto.hotel || [];
                const hotelData = hotels.map(hotel => ({
                    name_zh: hotel.name_zh,
                    address_zh: hotel.address_zh,
                    classname_zh: hotel.classname_zh
                }));
                resolve(hotelData);
            });
        });
    });
}

// Excel解析函数
function parseExcel(excelPath) {
    return new Promise((resolve, reject) => {
        const workbook = new Excel.Workbook();
        workbook.xlsx.readFile(excelPath)
           .then(() => {
                const worksheet = workbook.getWorksheet(1);
                const data = [];
                worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
                    if (rowNumber > 1) {
                        const rowData = {};
                        worksheet.columns.forEach((column, colIndex) => {
                            const header = column.header;
                            rowData[header] = row.values[colIndex + 1];
                        });
                        data.push(rowData);
                    }
                });
                resolve(data);
            })
           .catch((error) => {
                console.error('Excel解析错误:', error);
                resolve([]);
            });
    });
}

// 初始化RAG系统
async function initRag() {
    try {
        // 1. 加载向量化模型
        model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('模型加载完成');

        // 2. 解析酒店XML数据（dst_hotel.xml）
        console.log('开始解析酒店XML数据');
        const hotelData = await parseXml('./dst_hotel.xml');
        console.log(`解析酒店XML数据完成，共解析到 ${hotelData.length} 条酒店数据`);
        const hotelChunks = hotelData.map(hotel => ({
            text: `${hotel.name_zh?.[0] || ''} ${hotel.address_zh?.[0] || ''}`,
            metadata: {
                source: 'hotel',
                class: hotel.classname_zh?.[0] || '',
                address: hotel.address_zh?.[0] || ''
            }
        }));

        // 3. 解析旅游数据Excel（MacaoDistrictTourismData_202403.xlsx）
        console.log('开始解析旅游数据Excel');
        const tourismData = await parseExcel('./MacaoDistrictTourismData_202403.xlsx');
        console.log(`解析旅游数据Excel完成，共解析到 ${tourismData.length} 条旅游数据`);
        const tourismChunks = tourismData.map(tour => ({
            text: `${tour['統計分區'] || ''} ${tour['到訪人次'] || ''}`,
            metadata: {
                source: 'tourism',
                time: `${tour['年']}年${tour['月']}月${tour['時段'] || '全天'}`,
                district: tour['統計分區'] || '',
                visitor_count: tour['到訪人次'] || ''
            }
        }));

        // 4. 合并所有数据
        chunks = [...hotelChunks, ...tourismChunks];
        console.log(`合并数据完成，共合并 ${chunks.length} 条数据`);

        // 5. 生成向量化并构建索引（仅当数据存在时执行）
        if (chunks.length === 0) {
            console.error('没有可用数据，无法构建索引');
            return;
        }

        const batchSize = 100; // 每批次生成的向量数量
        const embeddings = [];

        for (let i = 0; i < chunks.length; i += batchSize) {
            const batchChunks = chunks.slice(i, i + batchSize);
            console.log(`开始生成第 ${i + 1} 到 ${Math.min(i + batchSize, chunks.length)} 个向量`);

            const batchEmbeddings = await Promise.all(batchChunks.map(async (chunk) => {
                const embedding = await model(chunk.text, { pooling: 'mean', normalize: true });
                if (embedding.data.length!== 384) {
                    console.error(`向量维度异常，文本: ${chunk.text}，维度: ${embedding.data.length}`);
                }
                return embedding.data;
            }));

            embeddings.push(...batchEmbeddings);
            console.log(`第 ${i + 1} 到 ${Math.min(i + batchSize, chunks.length)} 个向量生成完成`);
        }

        const vectorData = new Float32Array(embeddings.flat());

        // 检查数组长度是否符合要求
        if (vectorData.length % 384!== 0) {
            console.error(`向量数组长度不符合要求（当前长度: ${vectorData.length}），尝试截断...`);
            const validLength = Math.floor(vectorData.length / 384) * 384;
            const validVectorData = Array.from(vectorData.slice(0, validLength)); // 转换为普通数组
            console.log(`截断后向量数组长度: ${validVectorData.length}`);
            // 使用截断后的向量数据
            index = new faiss.IndexFlatL2(384);
            index.add(validVectorData);
        } else {
            // 数组长度符合要求，正常构建索引
            index = new faiss.IndexFlatL2(384);
            index.add(Array.from(vectorData)); // 转换为普通数组
        }

        console.log(`RAG初始化完成，加载文档数：${chunks.length}`);
    } catch (error) {
        console.error('RAG初始化失败:', error);
    }
}

// 初始化RAG（服务器启动时加载数据）
(async () => {
    await initRag();
    console.log('RAG数据加载完成');
})();

// 修改静态文件中间件配置
app.use(cors({ origin: '*' })); // 临时允许所有跨域请求
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'text/javascript');
            console.log('Serving JavaScript file:', path);
        }
    }
}));

const config = {
    amapApiKey: process.env.AMAP_API_KEY,
    dbConfig: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    }
};

app.use((req, res, next) => {
    console.log(`Received ${req.method} request to ${req.url}`);
    next();
});

// 新增RAG检索接口
app.post('/api/rag-search', async (req, res) => {
    console.log('Received POST request to /api/rag-search');
    console.log('Request method:', req.method);
    console.log('Request headers:', req.headers);
    const { query, topK = 3 } = req.body;
    if (!model || !index) {
        console.error('RAG未初始化');
        return res.status(500).json({ error: 'RAG未初始化' });
    }
    try {
        const queryEmbedding = await model(query, { pooling: 'mean', normalize: true });
        const [distances, indices] = index.search(queryEmbedding.data, topK);
        const relevantDocs = indices[0].map(i => chunks[i]).filter((_, idx) => distances[0][idx] < 0.8);
        const responseData = { relevantDocs: relevantDocs.map(doc => doc.text) };
        console.log('Response data:', responseData);
        res.json({ relevantDocs: relevantDocs.map(doc => doc.text) });
    } catch (error) {
        console.error('RAG搜索失败:', error);
        res.status(500).json({ error: 'RAG搜索失败' });
    }
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
    console.log(`✅ 服务器运行中: http://localhost:${port}`);
    console.log(`🔍 调试接口: http://localhost:${port}/api/debug`);
});
