var cottonwayControllers = angular.module('cottonwayControllers', []);

cottonwayControllers.controller('LoadingCtrl', function($scope, $cookies, $location, $wamp, errors) {
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
                    $location.path('/main');
                }
            });
        }
    }
});

cottonwayControllers.controller('SignInCtrl', function($scope, $cookies, $location, $wamp, errors) {
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
        errors.check(r);
        $cookies.backend_auth_data = r.authData;
        $location.path('/main');
    }
});
