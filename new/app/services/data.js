var services = require('../core/services'),
    cache = {};

services.factory('dataService', ['$rootScope', function ($rootScope) {

    return function (key) {

        cache[key] = cache[key] || $rootScope.$new();

        return cache[key];
    };
}]);