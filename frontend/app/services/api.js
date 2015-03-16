var services = require('../core/services'),
    _ = require('lodash');

services.factory('apiService', ['$wamp', '$q', 'errorService', function ($wamp, $q, errorService) {



    function call (method, data, named, options) {

        var defer = $q.defer(),
            arr = _.isArray(data) ? data : _.values(data);

        named = named || {};
        options = options || {};

        $wamp.call(method, arr, named, _.extend({
            disclose_me: true
        }, options))
            .then(function (response) {

                if (!response || response.callStatus) {

                    !options.silent && errorService.show(response);
                    defer.reject(response);
                } else {

                    defer.resolve(response);
                }
            }, function (err) {

                !options.silent && errorService.show(err);
                defer.reject(err);
            });

        return defer.promise;
    }

    function subscribe (method, callback) {

        return $wamp.subscribe(method, callback);
    }

    return {
        call: call,
        subscribe: subscribe
    };
}]);