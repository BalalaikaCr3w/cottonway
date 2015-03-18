var controllers = require('../../core/controllers'),
    _ = require('lodash'),
    diff = require('deep-diff');

controllers.controller('adminController', ['$scope', '$rootScope', '$timeout', 'apiService', 'modalService', adminController]);

function adminController ($scope, $rootScope, $timeout, apiService, modalService) {

    $scope.quest = {};
    $scope.task = {};
    $scope.tasksById = {};
    $scope.stepsById = {};

    $timeout(function () {

        loadSteps();
        loadPeers();
        loadTasks();
        loadUsers();
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

    $scope.openStep = function (step) {

        $scope.questStep = _.cloneDeep(step);
        $scope.currentStep = step;
        $scope.modalData = {
            res: {}
        };

        modalService({
            $scope: $scope,
            title: 'Шаг ' + step.seq,
            template: 'app/modules/admin/modal-step.html',
            data: $scope.modalData,
            onClose: function () {
                $scope.questStep = false;
            }
        });
    };

    $scope.saveStep = function () {

        var data = _.reduce(diff($scope.questStep, $scope.currentStep), function (memo, item) {

            memo[item.path[0]] = item.lhs;

            return memo;
        }, {});

        if (!data.needInput) {
            delete data.flag;
        }

        if (!data.hasAction) {
            delete data.actionName;
        }

        if (!_.isEmpty(data)) {
            if ($scope.questStep.id) {
                data.id = $scope.questStep.id;
            } else {
                data.hasAction = !!data.hasAction;
                data.isActive = !!data.isActive;
                data.needInput = !!data.needInput;
                data.actionName = '';
                data.flag = '';
            }
        }

        if (_.isString(data.seq)) {
            data.seq = parseInt(data.seq);
        }

        !_.isEmpty(data) && apiService.call("club.cottonway.admin.update_step", [data], {}, {
            silent: true
        })
            .then(function () {
                $scope.modalData.res = {
                    type: 'success',
                    errorMessage: 'Done!'
                };
            })
            .catch(function (err) {

                var def = {
                    errorMessage: 'Произошла ошибка',
                    type: 'danger'
                };

                $scope.modalData.res = _.extend({}, def, err);
            });
    };

    $scope.openTask = function (item) {

        $scope.task = _.cloneDeep(item);
        $scope.currentTask = item;
        $scope.modalData = {
            res: {}
        };

        modalService({
            $scope: $scope,
            title: item.title,
            template: 'app/modules/admin/modal-task.html',
            data: $scope.modalData,
            onClose: function () {
                $scope.task = false;
            }
        });
    };

    $scope.saveTask = function () {

        var tmp = $scope.task.categories,
            data;

        $scope.task.categories = _.map(_.isString(tmp) ? tmp.split(',') : tmp, function (item) {
            return _.trim(item);
        });

        data = _.reduce(diff($scope.task, $scope.currentTask), function (memo, item) {

            if (item.path[0] === 'categories') {

                memo[item.path[0]] = $scope.task.categories;
            } else {

                memo[item.path[0]] = item.lhs;
            }

            return memo;
        }, {});

        if (!_.isEmpty(data)) {
            if ($scope.task.id) {
                data.id = $scope.task.id;
            } else {
                data.isOpen = !!data.isOpen;
            }
        }

        if (_.isString(data.price)) {
            data.price = parseInt(data.price);
        }

        !_.isEmpty(data) && apiService.call("club.cottonway.admin.update_task", [data], {}, {
            silent: true
        })
            .then(function () {
                $scope.modalData.res = {
                    type: 'success',
                    errorMessage: 'Done!'
                };
            })
            .catch(function (err) {

                var def = {
                    errorMessage: 'Произошла ошибка',
                    type: 'danger'
                };

                $scope.modalData.res = _.extend({}, def, err);
            });

    };

    apiService.subscribe('club.cottonway.admin.on_task_updated', loadTasks);

    apiService.subscribe('club.cottonway.admin.on_step_updated', loadSteps);

    function loadTasks (task) {

        $scope.currentTask = task;

        apiService.call("club.cottonway.admin.tasks")
            .then(function(response){
                $scope.tasks = response.tasks;
                $scope.tasksById = {};
                _.each($scope.tasks, function (item) {
                    $scope.tasksById[item.id] = item;
                });
            })
    }

    function loadPeers () {
        apiService.call('club.cottonway.common.peers')
            .then(function (response) {
                $scope.peers = response.peers;
            });
    }

    function loadSteps (step) {

        $scope.currentStep = step;

        apiService.call('club.cottonway.admin.steps')
            .then(function (response) {
                $scope.steps = _.sortBy(response.steps, 'seq');
                $scope.stepsById = {};
                _.each($scope.steps, function (item) {
                    $scope.stepsById[item.id] = item;
                });
            });
    }

    function loadUsers () {

        apiService.call('club.cottonway.admin.users')
            .then(function (response) {
                $scope.users = response.peers;
            });
    }
}