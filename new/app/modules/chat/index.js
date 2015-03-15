var controllers = require('../../core/controllers'),
    moment = require('moment'),
    _ = require('lodash');

controllers.controller('chatController', ['$scope', 'apiService', 'dataService', chatController]);

function chatController ($scope, apiService, dataService) {

    $scope.messages = {};

    apiService.subscribe('club.cottonway.chat.on_new_room', onNewRoom);

    apiService.subscribe('club.cottonway.chat.on_new_message', onNewMessage);

    apiService.subscribe('club.cottonway.chat.on_new_peer', onNewPeer);

    apiService.call('club.cottonway.chat.rooms')
        .then(function (response) {

            var peerIds = [];

            $scope.rooms = {};

            response.rooms = response.rooms || [];

            _.each(response.rooms, function (room) {

                $scope.rooms[room.id] = room;
                $scope.messages[room.id] = [];
                peerIds = _.union(peerIds, room.peerIds);

                apiService.call('club.cottonway.chat.messages', [
                    room.id,
                    null
                ])
                    .then(function(list) {

                        $scope.messages[room.id] = list.messages;
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

            if (response.rooms.length !== 0) {
                $scope.currentRoom = response.rooms[0];
            }
        });

    $scope.startRoom = function (peerId) {

        apiService.call('club.cottonway.chat.start_room', [
            [peerId]
        ])
            .then(function(response) {

                $scope.rooms[response.room.id] = response.room;
                $scope.messages[response.room.id] = [];
            });
    };

    $scope.sendMessage = function (text) {

        apiService.call('club.cottonway.chat.send_message', [
            $scope.currentRoom.id,
            text
        ])
            .then(function (response) {

                $scope.message = '';
                $scope.messages[$scope.currentRoom.id].push(response.message);
            });
    };

    $scope.setCurrentRoom = function (room) {

        $scope.currentRoom = room;
    };

    $scope.roomTitle = function (room) {

        return room.isPrivate && !_.isUndefined($scope.peers) ?
            $scope.peers[room.peerIds[0]].name :
            room.title;
    };

    $scope.getPeer = function (message) {

        if (message.sender === dataService('user').user.id) {
            return dataService('user').user;
        } else {
            return $scope.peers[message.sender];
        }
    };

    function onNewRoom(args) {

        $scope.rooms[args[0].id] = args[0];
        $scope.messages[args[0].id] = [];
    }

    function onNewMessage(args) {

        var roomId = args[0].roomId;

        !_.isUndefined($scope.messages[roomId]) && $scope.messages[roomId].push(args[0]);
    }

    function onNewPeer(args) {

        var roomId = args[0].roomId,
            peer = args[0].peer;

        $scope.peers[peer.id] = peer;

        !_.isUndefined($scope.rooms[roomId]) && $scope.rooms[roomId].peerIds.push(peer.id);
    }
}