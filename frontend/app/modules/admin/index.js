var controllers = require('../../core/controllers'),
    _ = require('lodash'),
    diff = require('deep-diff'),
    moment = require('moment');

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

    $scope.$watch('quest.peer', function (peer) {

        var user,
            step;

        $scope.userLastStep = false;

        if (peer && peer.id) {

            user = _.find($scope.users, {id: peer.id});

            if (user) {

                step = _.chain(user.stepMoments)
                    .map(function (item) {
                        return _.extend({
                            formatted: moment(new Date(item.time)).format('HH:mm'),
                            timestamp: new Date(item.time).getTime()
                        }, item);
                    })
                    .sortBy('timestamp')
                    .last()
                    .value();

                $scope.userLastStep = _.extend(step, _.find($scope.steps, {id: step.stepId}));
            }
        }
    });

    $scope.startsWith = function(id, viewValue) {
        var user = _.find($scope.users, {id: id});
        return user && user.name.substr(0, viewValue.length).toLowerCase() === viewValue.toLowerCase();
    };

    $scope.filters = {
        name: {
            value: 'name',
            direction: 1
        },
        points: {
            value: 'score',
            direction: 1
        },
        steps: {
            value: 'steps',
            direction: 1,
            rule: function (user) {
                return user.stepMoments.length
            }
        },
        tasks: {
            value: 'tasks',
            direction: 1,
            rule: function (user) {
                return user.solvedTaskIds.length
            }
        }
    };

    $scope.sortTable = function (filter) {

        if ($scope.currentFilter && filter.value !== $scope.currentFilter.value) {
            _.each($scope.filters, function (item) {
                item.direction = 1;
            });
        }

        $scope.currentFilter = filter;

        $scope.usersSorted = _.sortBy($scope.users, function (user) {
            return filter.rule && filter.rule(user) || user[filter.value];
        });

        filter.direction < 0 && $scope.usersSorted.reverse();

        filter.direction *= -1;
    };

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
                $scope.peers = _.sortBy(response.peers, 'name');
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
                $scope.users = _.sortBy(response.peers, 'name');
                $scope.sortTable($scope.filters.name);
            });
    }
}