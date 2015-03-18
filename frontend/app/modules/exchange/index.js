var controllers = require('../../core/controllers'),
    _ = require('lodash');

controllers.controller('exchangeController', ['$scope','apiService', 'modalService', exchangeController]);

function exchangeController ($scope, apiService, modalService) {

    load();

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

    $scope.open = function (item) {

        modalService({
            $scope: $scope,
            title: item.title,
            template: 'app/modules/exchange/modal.html',
            data: item,
            onClose: function () {
                item.error = false;
            }
        });
    };

    $scope.sendFlag = function (task, flag, captcha) {

        task.error = false;

        flag && /*captcha &&*/ apiService.call('club.cottonway.exchange.send_flag', [task.id, flag], {
            /*recaptcha: captcha*/
        }, {
            silent: true
        })
            .catch(function (err) {

                var def = {
                    errorMessage: 'Произошла ошибка'
                };

                if (!err || err.callStatus !== 0) {
                    task.error = _.extend({}, def, err);
                }
            });
    };

    apiService.subscribe('club.cottonway.exchange.on_task_updated', load);

    function load () {

        apiService.call('club.cottonway.exchange.tasks')
            .then(function (response) {

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
    }
}
