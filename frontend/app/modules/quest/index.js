var controllers = require('../../core/controllers'),
    moment = require('moment'),
    _ = require('lodash');

controllers.controller('questController', ['$scope', 'apiService', questController]);

function questController ($scope, apiService) {

    load();

    apiService.subscribe('club.cottonway.quest.on_step_updated', load);

    function load () {

        apiService.call('club.cottonway.quest.steps')
            .then(function (response) {

                console.log(response);

                $scope.messages = _.chain(response.steps)
                    .sortBy(function (item) {
                        return -(new Date(item.time)).getTime()
                    })
                    .map(function (item) {

                        return _.extend({
                            timeFormatted: moment(item.time).format('DD MMMM, HH:mm')
                        }, item);
                    })
                    .value();
            });
    }
}