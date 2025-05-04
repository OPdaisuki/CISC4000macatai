// rag.js
async function searchRag(query, topK = 3) {
    try {
        const response = await fetch('/api/rag-search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, topK })
        });
        if (!response.ok) {
            throw new Error('RAG搜索请求失败');
        }
        const data = await response.json();
        return data.relevantDocs;
    } catch (error) {
        console.error('RAG搜索失败:', error);
        return [];
    }
}

export { searchRag };
    
