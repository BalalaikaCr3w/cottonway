var controllers = require('../../core/controllers'),
    moment = require('moment'),
    _ = require('lodash');

controllers.controller('chatController', ['$scope', 'apiService', 'dataService', 'tokenService', chatController]);

function chatController ($scope, apiService, dataService, tokenService) {

    $scope.messages = {};
    $scope.scrollOptions = {
        static: true
    };

    apiService.subscribe('club.cottonway.chat.on_new_room', onNewRoom);

    apiService.subscribe('club.cottonway.chat.on_new_message', onNewMessage);

    apiService.subscribe('club.cottonway.chat.on_new_peer', onNewPeer);

    apiService.call('club.cottonway.chat.rooms')
        .then(function (response) {

            var peerIds = [],
                rooms = [];

            _.each(response.rooms, function (room) {

                rooms.push(room);
                $scope.messages[room.id] = [];
                peerIds = _.union(peerIds, room.peerIds);

                apiService.call('club.cottonway.chat.messages', [
                    room.id,
                    null
                ])
                    .then(function(list) {

                        $scope.messages[room.id] = _.chain(list.messages)
                            .map(function (item) {
                                formatTime(item);
                                return item;
                            })
                            .sortBy(function (item) {
                                return new Date(item.time).getTime();
                            })
                            .value();
                    });
            });

            apiService.call('club.cottonway.chat.peers', [
                peerIds
            ])
                .then(function (data) {

                    $scope.peers = _.reduce(data.peers, function (memo, peer) {

                        memo[peer.id] = peer;
                        return memo;
                    }, {});
                });

            $scope.rooms = _.sortBy(rooms, function (item) {
                return +item.isPrivate;
            });
            $scope.currentRoom = _.first($scope.rooms);
        });

    $scope.startRoom = function (peerId) {

        var room = _.find($scope.rooms, function (item) {
            return item.isPrivate && item.peerIds[0] === peerId;
        });

        if (room) {

            $scope.setCurrentRoom(room);
        } else {

            apiService.call('club.cottonway.chat.start_room', [
                [peerId]
            ])
                .then(function (response) {

                    $scope.rooms.push(response.room);
                    $scope.messages[response.room.id] = [];
                    $scope.setCurrentRoom(response.room);
                });
        }
    };

    $scope.sendMessage = function (text) {

        if (text) {
            if (dataService('needSign').var) {
                tokenService.signMessage(dataService('certId').var, text)
                    .then(function (signature) {
                        send(text, signature);
                    });
            } else {
                send(text, null);
            }
        }

        function send (text, signature) {

            var options = {};

            if (signature) {
                options.signature = signature;
            }

            $scope.blocked = true;

            apiService.call('club.cottonway.chat.send_message', [
                $scope.currentRoom.id,
                text
            ], options)
                .then(function (response) {

                    $scope.scrollOptions.static = false;
                    $scope.message = '';
                    formatTime(response.message);
                    $scope.messages[$scope.currentRoom.id].push(response.message);
                })
                .finally(function () {
                    $scope.blocked = false;
                });
        }
    };

    $scope.setCurrentRoom = function (room) {

        room.newCount = 0;
        $scope.scrollOptions.static = true;
        $scope.currentRoom = room;
    };

    $scope.roomTitle = function (room) {

        return room.isPrivate && !_.isUndefined($scope.peers) ?
            $scope.peers[room.peerIds[0]].name :
            room.title;
    };

    $scope.getPeer = function (message) {

        if (message.sender === dataService('api').user.id) {
            return dataService('api').user;
        } else {
            return $scope.peers[message.sender];
        }
    };

    function onNewRoom(args) {

        $scope.rooms.push(args[0]);
        $scope.messages[args[0].id] = [];
    }

    function onNewMessage(args) {

        var roomId = args[0].roomId,
            room = _.find($scope.rooms, {id: roomId});

        if (room) {
            room.newCount = room.newCount || 0;
            room.newCount += +($scope.currentRoom.id !== roomId);
        }

        $scope.scrollOptions.static = false;

        formatTime(args[0]);
        !_.isUndefined($scope.messages[roomId]) && $scope.messages[roomId].push(args[0]);
    }

    function onNewPeer(args) {

        var roomId = args[0].roomId,
            peer = args[0].peer,
            room = _.find($scope.rooms, {id: roomId});

        $scope.peers[peer.id] = peer;

        room && room.peerIds.push(peer.id);
    }

    function formatTime (message) {
        message.timeFormatted = moment(new Date(message.time)).format('HH:mm');
    }
}
