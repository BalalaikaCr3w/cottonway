var controllers = require('../../core/controllers'),
    moment = require('moment'),
    _ = require('lodash');

controllers.controller('questController', ['$scope', 'apiService', questController]);

function questController ($scope, apiService) {

    apiService.call('club.cottonway.quest.steps')
        .then(function (response) {

            $scope.messages = _.map(response.steps, function (item) {

                return _.extend({
                    timeFormatted: moment(item.time).format('DD MMMM, HH:mm')
                }, item);
            });
        });
}