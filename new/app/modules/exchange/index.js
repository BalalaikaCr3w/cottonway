var controllers = require('../../core/controllers');

controllers.controller('exchangeController', ['$scope','apiService',  exchangeController]);

function exchangeController ($scope, apiService) {

    apiService.call('club.cottonway.exchange.tasks')
        .then(function (response) {
            console.log(response);
        });
}