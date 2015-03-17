var controllers = require('../../core/controllers'),
    _ = require('lodash');

controllers.controller('adminController', ['$scope', '$rootScope', '$timeout', 'apiService', adminController]);

function adminController ($scope, $rootScope, $timeout, apiService) {

    $scope.quest = {};

    $timeout(function () {
        apiService.call('club.cottonway.quest.all_steps')
            .then(function (response) {
                $scope.steps = response.steps;
            });

        apiService.call('club.cottonway.common.peers')
            .then(function (response) {
                $scope.peers = response.peers;
            });
    }, 1000);

    $scope.openStepToPeer = function () {

        $rootScope.alert = false;

        $scope.quest.peer && $scope.quest.peer.id &&
            apiService.call('club.cottonway.admin.open_next_step', {
                peerId: $scope.quest.peer.id
            })
                .then(function () {
                    $rootScope.alert = {
                        type: 'success',
                        errorMessage: 'Done!'
                    };
                    $scope.quest.peer = '';
                });
    };

    $scope.formatPeer = function (peer) {

        return peer && peer.name || '';
    };
}