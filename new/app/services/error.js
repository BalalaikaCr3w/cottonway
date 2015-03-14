var services = require('../core/services');

services.factory('errorService', ['$rootScope', function ($rootScope) {

    var errors = {
            1: {
                msg: 'Произошла ошибка',
                type: 'danger'
            }
        },
        methods = {

            show: function (err) {
                $rootScope.alert = errors[(err || {}).callStatus || 1];
            },

            hide: function () {
                $rootScope.alert = false;
            }
        };

    return methods;
}]);