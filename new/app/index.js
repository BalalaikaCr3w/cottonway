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
        name: 'Application'
    })
    .config(['$urlRouterProvider', '$stateProvider', '$wampProvider', function ($urlRouterProvider, $stateProvider, $wampProvider) {

        $urlRouterProvider.otherwise('/');

        angular.forEach(routes.list, function (route) {
            var options = route;
            $stateProvider.state(route.name, angular.extend({}, options));
        });

        $wampProvider.init(apiConfig);
    }])
    .run(['$rootScope', '$wamp', 'App', function ($rootScope, $wamp, App) {

        $rootScope.App = App;
        $wamp.open();
    }]);

require('./../templates.js');

angular.bootstrap(document, ['app']);