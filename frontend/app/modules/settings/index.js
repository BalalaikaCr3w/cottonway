var controllers = require('../../core/controllers');

controllers.controller('settingsController', ['$scope', 'pluginService', 'tokenService', 'dataService', settingsController]);

function settingsController ($scope, pluginService, tokenService, dataService) {
    $scope.needSign = dataService('needSign').var;
    $scope.certId = dataService('certId').var;

    $scope.isPluginLoaded = function () {
        return pluginService.isLoaded;
    };

    $scope.login = function(pin) {
        tokenService.login(pin)
            .then(function () {
                if (tokenService.certs.length != 0) {
                    $scope.certId = tokenService.certs[0].certId;
                }
                $scope.apply();
            });
    };

    $scope.token = tokenService;
}
