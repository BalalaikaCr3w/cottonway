var controllers = require('../../core/controllers'),
    _ = require('lodash'),
    diff = require('deep-diff');

controllers.controller('adminController', ['$scope', '$rootScope', '$timeout', 'apiService', 'modalService', adminController]);

function adminController ($scope, $rootScope, $timeout, apiService, modalService) {

    $scope.quest = {};
    $scope.task = {};

    $timeout(function () {
        //apiService.call('club.cottonway.admin.steps')
        //    .then(function (response) {
        //        $scope.steps = response.steps;
        //    });

        apiService.call('club.cottonway.common.peers')
            .then(function (response) {
                $scope.peers = response.peers;
            });

        apiService.call("club.cottonway.admin.tasks")
            .then(function(response){
                $scope.tasks = response.tasks;
            })
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

    $scope.openTask = function (item) {

        $scope.task = _.cloneDeep(item);
        $scope.currentTask = item;
        $scope.modalData = {
            res: {}
        };

        modalService({
            $scope: $scope,
            title: item.title,
            template: 'app/modules/admin/modal.html',
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

        apiService.call("club.cottonway.admin.update_task", [data], {}, {
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

    }
}