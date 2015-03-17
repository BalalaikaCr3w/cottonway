var controllers = require('../../core/controllers'),
    _ = require('lodash');

controllers.controller('ratingController', ['$scope', 'apiService', 'dataService', ratingController]);

function ratingController ($scope, apiService, dataService) {

    $scope.$watch(function () {

        return dataService('api').user;
    }, function (user) {

        $scope.place = _.findIndex($scope.players, {id: user.id}) + 1;
    });

    load();

    apiService.subscribe('club.cottonway.common.on_rating_updated', load);

    function load () {

        apiService.call('club.cottonway.common.rating')
            .then(function (response) {

                $scope.players = response.rating;
            });
    }
}