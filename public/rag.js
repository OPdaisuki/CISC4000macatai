async function searchRag(query, topK = 3) {
    try {
        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, topK })
        };
        console.log('Request options:', requestOptions);
        const response = await fetch('/api/rag-search', requestOptions);
        if (!response.ok) {
            console.error('RAG搜索请求失败，状态码:', response.status);
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
