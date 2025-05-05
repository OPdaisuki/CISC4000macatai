const faiss = require('faiss-node');
let model;
let index;
let chunks = [];
let isInitializing = false;

// XML解析函数（CommonJS 风格，使用 require 加载同步依赖）
function parseXml(xmlPath) {
    const fs = require('fs');
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

// Excel解析函数（CommonJS 风格，使用 require 加载同步依赖）
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
                            rowData[header] = row.values[colIndex + 1] || ''; // 处理空值
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

// 初始化RAG系统（异步加载ES模块）
async function initRag() {
    try {
        // 动态导入ES模块（解决 ERR_REQUIRE_ESM 错误）
        const { pipeline } = await import('@xenova/transformers');
        
        // 1. 加载向量化模型
        model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('模型加载完成');

        // 2. 解析酒店XML数据（dst_hotel.xml）
        console.log('开始解析酒店XML数据');
        const hotelData = await parseXml('./dst_hotel.xml');
        console.log(`解析酒店XML数据完成，共解析到 ${hotelData.length} 条酒店数据`);
        const hotelChunks = hotelData.map(hotel => ({
            text: `${hotel.name_zh} ${hotel.address_zh}`, // 简化空值处理
            metadata: {
                source: 'hotel',
                class: hotel.classname_zh,
                address: hotel.address_zh
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
                district: tour['統計分區'],
                visitor_count: tour['到訪人次']
            }
        }));

        // 4. 合并所有数据
        chunks = [...hotelChunks, ...tourismChunks].filter(chunk => chunk.text.trim()!== ''); // 过滤无效数据
        console.log(`合并数据完成，共合并 ${chunks.length} 条有效数据`);

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
                    return new Float32Array(384); // 填充默认向量（避免维度错误）
                }
                return embedding.data;
            }));

            embeddings.push(...batchEmbeddings);
            console.log(`第 ${i + 1} 到 ${Math.min(i + batchSize, chunks.length)} 个向量生成完成`);
        }

        const vectorData = new Float32Array(embeddings.flat());

        // 检查数组长度是否符合要求（修复潜在的数组越界问题）
        const validLength = Math.floor(vectorData.length / 384) * 384;
        const validVectorData = vectorData.subarray(0, validLength); // 使用 subarray 替代 slice

        index = new faiss.IndexFlatL2(384);
        index.add(validVectorData); // 直接添加 Float32Array（faiss-node 支持原生 ArrayBuffer）
        console.log(`RAG初始化完成，加载文档数：${chunks.length}，向量数组长度：${validVectorData.length}`);

    } catch (error) {
        console.error('RAG初始化失败:', error.stack); // 记录完整堆栈
        throw error; // 向上抛出错误，确保外层捕获
    }
}

// 确保RAG已初始化（处理冷启动和并发初始化）
async function ensureRagInitialized() {
    if (model && index) return; // 已初始化，直接返回
    if (isInitializing) { // 等待正在进行的初始化
        while (!model || !index) await new Promise(resolve => setTimeout(resolve, 100));
        return;
    }
    isInitializing = true; // 标记初始化中
    try {
        await initRag(); // 执行初始化
    } finally {
        isInitializing = false; // 清除标记，无论成功与否
    }
}

// 导出Vercel无服务器函数处理函数
module.exports = async (req, res) => {
    // 处理CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end(); // 处理预检请求
    }

    if (req.method!== 'POST') {
        return res.status(405).json({ error: '仅支持POST方法' });
    }

    try {
        await ensureRagInitialized(); // 确保RAG已初始化
        const { query, topK = 3 } = req.body;

        // 执行RAG搜索
        const queryEmbedding = await model(query, { pooling: 'mean', normalize: true });
        const [distances, indices] = index.search(queryEmbedding.data, topK);
        
        // 过滤低相似度结果（距离阈值优化）
        const relevantDocs = indices[0]
            .map((i, idx) => chunks[i])
            .filter((_, idx) => distances[0][idx] < 0.7); // 降低阈值提高召回率

        return res.status(200).json({ 
            relevantDocs: relevantDocs.map(doc => doc.text),
            metadata: relevantDocs.map(doc => doc.metadata) // 返回元数据（可选）
        });

    } catch (error) {
        console.error('搜索处理错误:', error.stack);
        return res.status(500).json({ 
            error: '服务器内部错误', 
            details: '请检查Vercel日志获取更多信息' 
        });
    }
};
