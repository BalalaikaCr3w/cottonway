var angular = require('angular');
angular.module('app').run(['$templateCache', function($templateCache) {
  'use strict';

  $templateCache.put('app/modules/chat/index.html',
    "<div ng-controller=\"chatController\"><h1>Chat</h1></div>"
  );


  $templateCache.put('app/modules/exchange/index.html',
    "<div ng-controller=\"exchangeController\"><h1>Exchange</h1></div>"
  );


  $templateCache.put('app/modules/quest/index.html',
    "<div ng-controller=\"questController\"><h1>Quest</h1></div>"
  );


  $templateCache.put('app/modules/settings/index.html',
    "<dib ng-controller=\"settingsController\"><h1>Settings</h1></dib>"
  );
}]);