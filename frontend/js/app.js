var app = angular.module('cottonway', [
    'ngRoute',
    'ngCookies',
    'vxWamp',
    "cottonwayControllers"]);

app.config(function($routeProvider, $wampProvider) {
    $wampProvider.init({
        url: 'wss://cottonway.club/ws/',
        realm: 'realm1'
    });

    $routeProvider.
        when('/main', {
            templateUrl: 'partials/main.html'
        }).
        when('/sign-in', {
            templateUrl: 'partials/sign-in.html',
            controller: 'SignInCtrl'
        }).
        otherwise({
            templateUrl: 'partials/loading.html',
            controller: 'LoadingCtrl'
        });
});

app.run(function($wamp){
    $wamp.open();
});

app.factory('errors',function(){
    var errorDesc = {
        1: 'Ошибка'
    };
    
    return {
        check: function(r) {
            if (r.callStatus !== 0) {
                throw errorDesc[r.callStatus];
            }
        }
    };
});
