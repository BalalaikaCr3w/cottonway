var cottonwayControllers = angular.module('cottonwayControllers', []);

cottonwayControllers.controller('LoadingCtrl', function($scope, $cookies, $location, $wamp, errors, user) {
    if ($wamp.session != undefined) {
        process();
    } else {
        $scope.$on('$wamp.open', process);
    }

    function process() {
        if ($cookies.backend_auth_data == undefined) {
            $location.path('/sign-in');
        } else {
            $wamp.call('club.cottonway.auth.send_auth_data', [$cookies.backend_auth_data], {}, {disclose_me: true}).then(function (r) {
                if (r.callStatus !== 0) {
                    delete $cookies.backend_auth_data;
                    $location.path('/sign-in');
                } else {
                    user.user = r.user;
                    $location.path('/main');
                }
            });
        }
    }
});

cottonwayControllers.controller('SignInCtrl', function($scope, $cookies, $location, $wamp, errors, user) {
    $scope.$on('$wamp.close', function () {
        $location.path('/');
    });

    $scope.signUp = function(email, username, password) {
        $wamp.call('club.cottonway.auth.sign_up', [email, username, password], {}, {disclose_me: true})
            .then(signInCallback);
    };
    
    $scope.signIn = function(email, password) {
        $wamp.call('club.cottonway.auth.sign_in', [email, password], {}, {disclose_me: true})
            .then(signInCallback);
    };

    function signInCallback(r) {
        errors.check($scope, r);
        user.user = r.user;
        $cookies.backend_auth_data = r.authData;
        $location.path('/main');
    }
});

cottonwayControllers.controller("TaskCtrl", function($scope, $modalInstance, task) {
    $scope.task = task;

    $scope.send = function() {
        
    };

    $scope.close = function() {
        $modalInstance.dismiss();
    };
});

cottonwayControllers.controller("MainCtrl", function($scope, $modal) {
    $scope.tasks = [
        {
            name:"hello1",
            description:"klfjgdfs"
        },
        {
            name:"hello2",
            description:"klfjgdfs"
        },
        {
            name:"hello3",
            description:"klfjgdfs"
        },
        {
            name:"hello4",
            description:"klfjgdfs"
        }
    ];

    $scope.open = function(task){
        var modal = $modal.open({
            templateUrl: '/partials/task-modal.html',
            windowTemplateUrl: '/templates/modal.html',
            controller: 'TaskCtrl',
            keyboard:false,
            size: 'lg',
            backdrop:'static',
            resolve: {
                task : function(){
                    return task;
                }
            }
        });
    };
});

cottonwayControllers.controller('ChatCtrl', function($scope, $wamp, $location, errors, user) {
    $scope.messages = {};
    
    function onNewRoom(args) {
        $scope.rooms[args[0].id] = args[0];
        $scope.messages[args[0].id] = [];
    }
    $wamp.subscribe('club.cottonway.chat.on_new_room', onNewRoom);

    function onNewMessage(args) {
        var roomId = args[0].roomId;
        
        if ($scope.messages[roomId] != undefined) {
            $scope.messages[roomId].push(args[0]);
        }
    }
    $wamp.subscribe('club.cottonway.chat.on_new_message', onNewMessage);

    function onNewPeer(args) {
        var roomId = args[0].roomId;
        var peer = args[0].peer;

        $scope.peers[peer.id] = peer;
        
        if ($scope.rooms[roomId] != undefined) {
            $scope.rooms[roomId].peerIds.push(peer.id);
        }
    }
    $wamp.subscribe('club.cottonway.chat.on_new_peer', onNewPeer);
    
    $wamp.call('club.cottonway.chat.rooms', [], {}, {disclose_me: true}).then(function(r) {
        errors.check($scope, r);
        $scope.rooms = {};
        var peerIds = [];
        
        for (var i in r.rooms) {
            var room = r.rooms[i];
            $scope.rooms[room.id] = room;
            $scope.messages[room.id] = [];

            peerIds = _.union(peerIds, room.peerIds);

            (function (room) {
                $wamp.call('club.cottonway.chat.messages', [room.id, null], {}, {disclose_me: true}).then(function(r2) {
                    errors.check($scope, r2);
                    $scope.messages[room.id] = r2.messages;
                });
            })(room);
        }

        $wamp.call('club.cottonway.chat.peers', [peerIds], {}, {disclose_me: true}).then(function(r2) {
            errors.check($scope, r2);
            var p = {};
            for (i in r2.peers) {
                p[r2.peers[i].id] = r2.peers[i];
            }
            $scope.peers = p;
        });

        if (r.rooms.length != 0) {
            $scope.currentRoom = r.rooms[0];
        }
    });

    $scope.startRoom = function(peerId) {
        $wamp.call('club.cottonway.chat.start_room', [[peerId]], {}, {disclose_me: true}).then(function(r) {
            errors.check($scope, r);
            $scope.rooms[r.room.id] = r.room;
            $scope.messages[r.room.id] = [];
        });
    };

    $scope.sendMessage = function(text) {
        $wamp.call('club.cottonway.chat.send_message', [$scope.currentRoom.id, text], {}, {disclose_me: true}).then(function(r) {
            errors.check($scope, r);
            $scope.message = "";
            $scope.messages[$scope.currentRoom.id].push(r.message);
        });
    };

    $scope.setCurrentRoom = function(room) {
        $scope.currentRoom = room;
    };

    $scope.roomTitle = function(room) {
        if (room.isPrivate && $scope.peers != undefined) {
            return $scope.peers[room.peerIds[0]].name;
        } else {
            return room.title;
        }
    };

    $scope.formatTime = function(timestr) {
        function pad(num) {
            if (num < 10) {
                return '0' + num;
            } else {
                return num;
            }
        }
        var d = new Date(timestr);
        return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    };

    $scope.getPeer = function(message) {
        if (message.sender == user.user.id) {
            return user.user;
        } else {
            return $scope.peers[message.sender];
        }
    };
});
