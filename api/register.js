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
        // 这里可以添加注册逻辑，例如将用户名和密码保存到数据库
        // 为了简单起见，这里假设注册成功
        return res.status(200).json({ success: true, message: '注册成功' });
    } catch (error) {
        console.error('注册处理错误:', error.stack);
        return res.status(500).json({
            error: '服务器内部错误',
            details: '请检查Vercel日志获取更多信息'
        });
    }
};
