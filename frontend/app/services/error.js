var services = require('../core/services'),
    _ = require('lodash');

services.factory('errorService', ['$rootScope', function ($rootScope) {

    var def = {
            errorMessage: 'Произошла ошибка',
            type: 'danger'
        },
        methods = {

            show: function (err) {

                $rootScope.alert = _.extend({}, def, err);
            },

            hide: function () {
                $rootScope.alert = false;
            },

            custom: function (msg) {
                $rootScope.alert = {
                    msg: msg,
                    type: 'danger'
                };
            }
        };

    return methods;
}]);