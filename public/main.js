// public/js/main.js

// 初始化页面时自动加载数据
document.addEventListener('DOMContentLoaded', async () => {
    try {
      // 获取景点基础数据
      const attractions = await fetchAttractionsData();
      
      // 获取所有景点的周边餐厅数据
      const attractionsWithRestaurants = await Promise.all(
        attractions.map(async attraction => ({
          ...attraction,
          restaurants: await fetchRestaurantsData(attraction.latitude, attraction.longitude)
        }))
      );
  
      // 渲染景点卡片
      renderAttractionCards(attractionsWithRestaurants);
      
      // 初始化地图标记
      initMapMarkers(attractionsWithRestaurants);
      
    } catch (error) {
      showErrorNotification('数据加载失败，请刷新页面重试');
      console.error('初始化错误:', error);
    }
  });
  
  // 获取景点数据
  async function fetchAttractionsData() {
    try {
      const response = await fetch('/api/attractions');
      if (!response.ok) throw new Error(`HTTP错误! 状态码: ${response.status}`);
      return await response.json();
    } catch (error) {
      throw new Error(`景点数据获取失败: ${error.message}`);
    }
  }
  
  // 获取周边餐厅数据
  async function fetchRestaurantsData(lat, lng) {
    try {
      const response = await fetch(`/api/nearby-restaurants?lat=${lat}&lng=${lng}`);
      if (!response.ok) throw new Error(`HTTP错误! 状态码: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn(`周边餐厅数据获取失败（坐标 ${lat},${lng}）: ${error.message}`);
      return [];
    }
  }
  
  // 渲染景点卡片
  function renderAttractionCards(data) {
    const container = document.getElementById('attractions-container');
    
    // 清空现有内容
    container.innerHTML = '';
  
    // 生成卡片HTML
    data.forEach(item => {
      const card = document.createElement('div');
      card.className = 'attraction-card';
      card.innerHTML = `
        <h2 class="attraction-name">${item.name}</h2>
        <div class="attraction-meta">
          <span class="address">📍 ${item.address}</span>
          <span class="coordinates">🌐 ${item.longitude}, ${item.latitude}</span>
        </div>
        <div class="restaurants-section">
          <h3>周边美食（${item.restaurants.length}家）</h3>
          <ul class="restaurant-list">
            ${item.restaurants.map(r => `
              <li class="restaurant-item">
                <span class="name">🍴 ${r.name}</span>
                <span class="distance">${r.distance}米</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
      container.appendChild(card);
    });
  }
  
  // 初始化地图标记（需页面有<div id="map">）
  function initMapMarkers(data) {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
  
    // 简单版地图标记实现
    const mapHTML = data.map(item => `
      <div class="map-marker" style="left: ${normalizeCoord(item.longitude)}%; top: ${normalizeCoord(item.latitude)}%">
        <div class="marker-pin"></div>
        <div class="marker-info">${item.name}</div>
      </div>
    `).join('');
  
    mapContainer.innerHTML = mapHTML;
  }
  
  // 坐标标准化（示例实现）
  function normalizeCoord(coord) {
    const base = 115.0; // 澳门经度基准值
    return ((parseFloat(coord) - base) * 1000 + 50).toFixed(2);
  }
  
  // 错误通知
  function showErrorNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.innerHTML = `
      <span>⚠️ ${message}</span>
      <button onclick="this.parentElement.remove()">×</button>
    `;
    document.body.prepend(notification);
  }
  
  // 样式动态注入
  const dynamicStyles = document.createElement('style');
  dynamicStyles.textContent = `
    .attraction-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin: 20px 0;
      padding: 20px;
    }
  
    .attraction-name {
      color: #2c3e50;
      margin: 0 0 15px;
    }
  
    .attraction-meta {
      display: flex;
      gap: 15px;
      color: #7f8c8d;
      font-size: 0.9em;
      margin-bottom: 20px;
    }
  
    .restaurants-section h3 {
      color: #e67e22;
      margin: 0 0 10px;
    }
  
    .restaurant-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
  
    .restaurant-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
  
    .error-notification {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #e74c3c;
      color: white;
      padding: 15px 25px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 15px;
      animation: slideIn 0.3s ease-out;
    }
  
    @keyframes slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
  `;
  document.head.appendChild(dynamicStyles);