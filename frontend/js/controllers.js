var cottonwayControllers = angular.module('cottonwayControllers', []);

cottonwayControllers.controller('SignInCtrl', function($scope, $wamp, errors) {
    $scope.isConnected = false;
    
    $scope.$on("$wamp.open", function () {
        $scope.isConnected = true;
    });

    $scope.$on("$wamp.close", function () {
        $scope.isConnected = false;
    });

    $scope.signUp = function(email, username, password) {
        $wamp.call('club.cottonway.auth.sign_up', [email, username, password], {}, {disclose_me: true}).then(function(r) {
            errors.check(r);
        });
    };
    
    $scope.signIn = function(username, password) {
        $wamp.call('club.cottonway.auth.sign_in', [username, password], {}, {disclose_me: true}).then(function(r) {
            errors.check(r);
        });
    };
});
