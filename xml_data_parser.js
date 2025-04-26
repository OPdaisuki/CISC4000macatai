// 与server.js同级
module.exports = {
    parseHotels: (xmlData) => {
      return xmlData.Result.Record.map(item => ({
        name_zh: item.NameZh?.[0] || '未知名称',
        address_zh: item.AddressZh?.[0] || '地址不详',
        license_no: item.LicenseNo?.[0] || '未提供牌照'
      }));
    },
  
    parseRestaurants: (xmlData) => {
      return xmlData.Result.Record.map(item => ({
        name_zh: item.NameZh?.[0] || '未知餐厅',
        address_zh: item.AddressZh?.[0] || '地址不详',
        license_type: item.LicenseType?.[0] || '未分类'
      }));
    }
  };