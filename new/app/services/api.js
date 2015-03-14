var services = require('../core/services'),
    _ = require('lodash');

services.factory('apiService', ['$wamp', '$q', 'errorService', function ($wamp, $q, errorService) {



    function call (method, data, options) {

        var defer = $q.defer(),
            arr = _.isArray(data) ? data : _.values(data);

        $wamp.call(method, arr, {}, _.extend({
            disclose_me: true
        }, options))
            .then(function (response) {

                if (!response || response.callStatus !== 0) {

                    errorService.show(response);
                    defer.reject(response);
                } else {

                    defer.resolve(response);
                }
            }, function (err) {

                errorService.show(err);
                defer.reject(err);
            });

        return defer.promise;
    }

    return {
        call: call
    };
}]);