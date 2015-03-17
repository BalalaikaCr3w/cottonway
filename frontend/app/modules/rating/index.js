var controllers = require('../../core/controllers');

controllers.controller('ratingController', ['$scope', 'apiService', ratingController]);

function ratingController ($scope, apiService) {

    apiService.call('club.cottonway.common.rating')
        .then(function (response) {

            $scope.players = response.rating;
        });
}