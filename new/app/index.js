'use strict';

var angular = require('angular'),
    autobahn = require('autobahn'),
    controllers = require('./core/controllers'),
    directives = require('./core/directives'),
    services = require('./core/services'),
    filters = require('./core/filters'),
    routes = require('./configs/routes.json'),
    apiConfig = require('./configs/api.json'),
    dependencies,
    app;

require('angular-ui-router');
require('angular-bootstrap');
require('angular-cookies');
require('./../bower_components/angular-wamp/release/angular-wamp');
require('./modules');
require('./ui');
require('./services');
require('./filters');

window.autobahn = autobahn;

dependencies = [
    controllers.name,
    directives.name,
    services.name,
    filters.name,
    'ngCookies',
    'ui.router',
    'ui.bootstrap',
    'vxWamp'
];

app = angular
    .module('app', dependencies);

app
    .constant('App', {
        name: 'Cotton Way'
    })
    .config(['$urlRouterProvider', '$stateProvider', '$wampProvider', function ($urlRouterProvider, $stateProvider, $wampProvider) {

        $urlRouterProvider.otherwise('/');

        angular.forEach(routes.list, function (route) {
            var options = route;
            $stateProvider.state(route.name, angular.extend({}, options));
        });

        $wampProvider.init(apiConfig);
    }])
    .run(['$rootScope', '$wamp', '$state', '$cookies', 'App', 'dataService', 'apiService', 'errorService', run]);

require('./../templates.js');

angular.bootstrap(document, ['app']);

function run ($rootScope, $wamp, $state, $cookies, App, dataService, apiService, errorService) {

    $rootScope.App = App;
    $rootScope.$state = $state;
    $rootScope.isCollapsed = true;
    $wamp.open();

    $rootScope.$on('$stateChangeStart', function(e, toState, toParams, fromState, fromParams) {

        errorService.hide();

        if (!dataService('user').user && toState.private) {
            e.preventDefault();

            if (!angular.isUndefined($wamp.session)) {
                process();
            } else {
                $rootScope.$on('$wamp.open', process);
            }
        }
    });

    $rootScope.logout = function () {
        delete $cookies.backend_auth_data;
        $state.go('sign-in');
    };

    function process() {

        dataService('user').user = false;

        if (angular.isUndefined($cookies.backend_auth_data)) {

            $state.go('sign-in');
        } else {

            apiService.call('club.cottonway.auth.send_auth_data', [ $cookies.backend_auth_data ], {}, {
                disclose_me: true
            })
                .then(function (response) {
                    if (response.callStatus !== 0) {

                        delete $cookies.backend_auth_data;
                        $state.go('sign-in');
                    } else {

                        dataService('user').user = response.user;
                        $state.go('quest');
                    }
            });
        }
    }
}