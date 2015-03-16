apiConfig = require('../configs/api.json');

module.exports.makeUrl = function (url) {
    return /^https?:\/\//.test(url) ? url : apiConfig.server + url;
};