// 与server.js同级
const fetch = require('node-fetch');
const { parseStringPromise } = require('xml2js');

const DST_CONFIG = {
  appCode: '09d43a591fba407fb862412970667de4',
  endpoints: {
    hotel: 'dst_hotel',
    restaurant: 'dst_restaurant'
  }
};

module.exports = {
  fetchHotelData: async () => {
    const res = await fetch(`https://dst.apigateway.data.gov.mo/${DST_CONFIG.endpoints.hotel}`, {
      headers: { Authorization: `APPCODE ${DST_CONFIG.appCode}` }
    });
    return parseStringPromise(await res.text());
  },

  fetchRestaurantData: async () => {
    const res = await fetch(`https://dst.apigateway.data.gov.mo/${DST_CONFIG.endpoints.restaurant}`, {
      headers: { Authorization: `APPCODE ${DST_CONFIG.appCode}` }
    });
    return parseStringPromise(await res.text());
  }
};