var controllers = require('../../core/controllers'),
    _ = require('lodash');

controllers.controller('exchangeController', ['$scope','apiService',  exchangeController]);

function exchangeController ($scope, apiService) {

    apiService.call('club.cottonway.exchange.tasks')
        .then(function (response) {

            console.log(response);
            //response.tasks[0].isSolved = true;

            $scope.filters = _.reduce(response.tasks, function (memo, item) {

                _.each(item.categories, function (category) {

                    if (!_.find(memo, {value: category})) {

                        memo.push({
                            title: category,
                            value: category
                        });
                    }
                });

                return memo;
            }, []);

            $scope.filters = [{
                title: 'Все',
                value: {}
            }, {
                title: 'Нерешенные',
                value: {isSolved: false}
            }]
                .concat($scope.filters);

            $scope.currentFilter = $scope.filters[0];
            $scope.tasksFiltered = $scope.tasks = response.tasks;
        });

    $scope.filterTasks = function (filter) {

        if (_.isString(filter.value)) {

            $scope.tasksFiltered = _.filter($scope.tasks, function (item) {
                return _.indexOf(item.categories, filter.value) > -1;
            });
        } else {

            $scope.tasksFiltered = _.filter($scope.tasks, filter.value);
        }

        $scope.currentFilter = filter;
    };
}