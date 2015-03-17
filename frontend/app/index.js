'use strict';

var angular = require('angular'),
    autobahn = require('autobahn'),
    controllers = require('./core/controllers'),
    directives = require('./core/directives'),
    services = require('./core/services'),
    filters = require('./core/filters'),
    routes = require('./configs/routes.json'),
    apiConfig = require('./configs/api.json'),
    moment = require('moment'),
    cookie = require('cookie'),
    _ = require('lodash'),
    dependencies,
    cookies,
    app;

require('angular-ui-router');
require('angular-bootstrap');
require('angular-cookies');
require('angular-scroll');
require('./../bower_components/angular-wamp/release/angular-wamp');
require('./../node_modules/moment/locale/ru');
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
    'duScroll',
    'ngCookies',
    'ui.router',
    'ui.bootstrap',
    'vxWamp'
];

moment.locale("ru");

cookies = cookie.parse(document.cookie);

app = angular
    .module('app', dependencies);

app
    .constant('App', {
        name: 'Cotton Way'
    })
    .config(['$urlRouterProvider', '$stateProvider', '$wampProvider', function ($urlRouterProvider, $stateProvider, $wampProvider) {

        $urlRouterProvider.otherwise('/');

        _.each(routes.list, function (route) {
            var options = route;
            $stateProvider.state(route.name, angular.extend({}, options));
        });

        $wampProvider.init(cookies.developer ? apiConfig.dev : apiConfig.prod);
    }])
    .run(['$rootScope', '$wamp', '$state', '$cookies', '$location', 'App', 'dataService', 'apiService', 'errorService', run]);

require('./../templates.js');

angular.bootstrap(document, ['app']);

function run ($rootScope, $wamp, $state, $cookies, $location, App, dataService, apiService, errorService) {

    var firstRun = true,
        menu = ['quest', 'exchange', 'chat', 'settings', 'rating'];

    $rootScope.App = App;
    $rootScope.$state = $state;
    $rootScope.isCollapsed = true;

    $rootScope.menu = _.map(menu, function (item) {
        return _.find(routes.list, {name: item})
    });

    $wamp.open();

    $rootScope.$on('$stateChangeStart', function (e, toState, toParams, fromState, fromParams) {

        errorService.hide();

        if ((!dataService('api').user || firstRun) && toState.private) {
            e.preventDefault();

            if (getWampSession()) {
                process();
            } else {
                $rootScope.$on('$wamp.open', process);
            }
        }

        firstRun = false;
    });

    $rootScope.$on('$stateChangeSuccess', function (e) {

        $rootScope.isCollapsed = true;
    });

    $rootScope.logout = function () {
        $rootScope.setUser(false);
        delete $cookies.backend_auth_data;
        $state.go('sign-in');
    };

    $rootScope.closeAlert = function () {
        errorService.hide();
    };

    $rootScope.setUser = function (user) {
        $rootScope.user = dataService('api').user = user;
    };

    process();

    apiService.subscribe('club.cottonway.user.on_user_updated', $rootScope.setUser);

    function getWampSession () {
        return $wamp.session || $wamp.connection._session;
    }

    function process () {

        $rootScope.setUser(false);

        if (angular.isUndefined($cookies.backend_auth_data)) {

            $state.go('sign-in');
        } else {

            apiService.call('club.cottonway.auth.send_auth_data', [ $cookies.backend_auth_data ])
                .then(function (response) {
                    var state;

                    if (response.callStatus !== 0) {

                        delete $cookies.backend_auth_data;
                        $state.go('sign-in');
                    } else {

                        $rootScope.setUser(response.user);
                        state = $state.get($location.url().slice(1));
                        $state.go(state ? state.name : 'quest');
                    }
            });
        }
    }
}
