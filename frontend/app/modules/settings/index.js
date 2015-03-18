var controllers = require('../../core/controllers');

controllers.controller('settingsController', ['$scope', 'pluginService', 'tokenService', 'dataService', settingsController]);

function settingsController ($scope, pluginService, tokenService, dataService) {

    $scope.needSign = dataService('needSign').var;
    $scope.certId = dataService('certId').var;
    $scope.pin = {
        pin:''
    }

    $scope.isPluginLoaded = function () {

        return pluginService.isLoaded;
    };

    $scope.login = function () {

        tokenService.login($scope.pin.pin)
            .then(function () {

                if (tokenService.certs.length !== 0) {

                   // $scope.certId 
                   dataService('needSign').var = true;
                   dataService('certId').var = tokenService.certs[0].certId;
                }

                //$scope.$apply();
            })
    };

    $scope.token = tokenService;
}
