var controllers = require('../../core/controllers');

controllers.controller('ratingController', ['$scope', 'apiService', ratingController]);

function ratingController ($scope, apiService) {

    load();

    apiService.subscribe('club.cottonway.common.on_rating_updated', load);

    function load () {

        apiService.call('club.cottonway.common.rating')
            .then(function (response) {

                $scope.players = response.rating;
            });
    }
}