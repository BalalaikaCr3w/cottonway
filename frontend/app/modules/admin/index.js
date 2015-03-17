var controllers = require('../../core/controllers'),
    _ = require('lodash');

controllers.controller('adminController', ['$scope', '$timeout', 'apiService', adminController]);

function adminController ($scope, $timeout, apiService) {

    $timeout(function () {
        apiService.call('club.cottonway.quest.all_steps')
            .then(function (response) {
                $scope.steps = response.steps;
            });

        apiService.call('club.cottonway.common.peers')
            .then(function (response) {
                $scope.peers = response.peers;
                console.log(response);
            });
    }, 1000);

    $scope.openStepToPeer = function () {

        //club.cottonway.quest.open_step(peerId, stepId) -> void
    };

    $scope.formatPeer = function (id) {

        $scope.peer = _.find($scope.peers, {id: id});

        return $scope.peer && $scope.peer.name || '';
    };
}