var services = require('../core/services'),
    _ = require('lodash');

services.factory('modalService', ['$rootScope', '$modal', function ($rootScope, $modal) {

    var defaults = {
        templateUrl: 'app/ui/modal/index.html'
    };

    return function (options) {

        var scope = (options.$scope || $rootScope).$new();

        options = options || {
            template: 'app/ui/modal/modal.html'
        };

        scope.modalData = options.data;
        scope.modalSettings = {
            template: options.template || 'app/ui/modal/modal.html',
            title: options.title
        };

        return $modal.open(_.extend({
            scope: scope
        }, defaults));
    };
}]);