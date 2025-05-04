async function searchRag(query, topK = 3) {
    try {
        const queryParams = new URLSearchParams({ query, topK });
        const url = `/api/rag-search?${queryParams}`;
        const response = await fetch(url);
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
