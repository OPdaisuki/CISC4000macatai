const faiss = require('faiss-node');
const fs = require('fs');
const path = require('path');
let model;
let index;
let chunks = [];
let isInitializing = false;

// XML解析函数
function parseXml(xmlPath) {
    const xml2js = require('xml2js');
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
                    name_zh: hotel.name_zh?.[0] || '',
                    address_zh: hotel.address_zh?.[0] || '',
                    classname_zh: hotel.classname_zh?.[0] || ''
                }));
                resolve(hotelData);
            });
        });
    });
}

// Excel解析函数
function parseExcel(excelPath) {
    const Excel = require('exceljs');
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
                            rowData[header] = row.values[colIndex + 1] || '';
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
async function initRag(data = []) {
    // 参数类型检查
    if (!Array.isArray(data)) {
        console.error('initRag 参数类型无效，必须为数组:', data);
        throw new TypeError('第一个参数类型无效，必须为数组');
    }

    try {
        // 加载模型
        const { pipeline } = await import('@xenova/transformers');
        process.env.TRANSFORMERS_CACHE = '/tmp/@xenova/transformers/.cache'; // 指定缓存路径
        model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
            cache_dir: process.env.TRANSFORMERS_CACHE
        });
        console.log('模型加载完成');

        // 加载并解析数据
        const xmlFilePath = path.join(__dirname, '../dst_hotel.xml');
        const excelFilePath = path.join(__dirname, '../MacaoDistrictTourismData_202403.xlsx');
        const hotelData = await parseXml(xmlFilePath);
        const tourismData = await parseExcel(excelFilePath);

        // 数据合并
        const hotelChunks = hotelData.map(hotel => ({
            text: `${hotel.name_zh} ${hotel.address_zh}`,
            metadata: { source: 'hotel', class: hotel.classname_zh, address: hotel.address_zh }
        }));
        const tourismChunks = tourismData.map(tour => ({
            text: `${tour['統計分區'] || ''} ${tour['到訪人次'] || ''}`,
            metadata: { source: 'tourism', time: `${tour['年']}年${tour['月']}月${tour['時段'] || '全天'}`, district: tour['統計分區'], visitor_count: tour['到訪人次'] }
        }));
        chunks = [...hotelChunks, ...tourismChunks].filter(chunk => chunk.text.trim() !== '');
        console.log(`合并数据完成，共合并 ${chunks.length} 条有效数据`);

        // 构建索引
        if (chunks.length === 0) {
            console.error('没有可用数据，无法构建索引');
            return;
        }
        const embeddings = await Promise.all(chunks.map(async chunk => {
            const embedding = await model(chunk.text, { pooling: 'mean', normalize: true });
            return embedding.data;
        }));
        const vectorData = new Float32Array(embeddings.flat());
        index = new faiss.IndexFlatL2(384);
        index.add(vectorData);
        console.log(`RAG初始化完成，加载文档数：${chunks.length}，向量数组长度：${vectorData.length}`);
    } catch (error) {
        console.error('RAG初始化失败:', error.stack);
        throw error;
    }
}

// 确保RAG已初始化
async function ensureRagInitialized() {
    if (model && index) return;
    if (isInitializing) {
        while (!model || !index) await new Promise(resolve => setTimeout(resolve, 100));
        return;
    }
    isInitializing = true;
    try {
        await initRag([]);
    } finally {
        isInitializing = false;
    }
}

// 导出Vercel无服务器函数处理函数
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: '仅支持POST方法' });
    }

    try {
        await ensureRagInitialized();
        const { query, topK = 3 } = req.body;

        const queryEmbedding = await model(query, { pooling: 'mean', normalize: true });
        const [distances, indices] = index.search(queryEmbedding.data, topK);

        const relevantDocs = indices[0]
           .map((i, idx) => chunks[i])
           .filter((_, idx) => distances[0][idx] < 0.7);

        return res.status(200).json({
            relevantDocs: relevantDocs.map(doc => doc.text),
            metadata: relevantDocs.map(doc => doc.metadata)
        });
    } catch (error) {
        console.error('搜索处理错误:', error.stack);
        return res.status(500).json({
            error: '服务器内部错误',
            details: '请检查Vercel日志获取更多信息'
        });
    }
};
