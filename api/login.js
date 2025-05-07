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
        const { username, password } = req.body;
      
        return res.status(200).json({ success: true, message: '登录成功' });
    } catch (error) {
        console.error('登录处理错误:', error.stack);
        return res.status(500).json({
            error: '服务器内部错误',
            details: '请检查Vercel日志获取更多信息'
        });
    }
};
