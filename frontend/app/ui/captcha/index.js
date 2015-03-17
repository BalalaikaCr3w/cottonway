var directives = require('../../core/directives'),
    apiConfig = require('../../configs/api.json');

directives.directive('uiCaptcha', ['$window', function ($window) {

    return {
        restrict: 'A',
        scope: {
            captcha: '=uiCaptcha'
        },
        templateUrl: 'app/ui/captcha/index.html',
        link: function (scope, element, attrs) {

            var loader = element.children().eq(0),
                body = element.children().eq(1),
                deregister;

            //deregister= scope.$watch(function () {
            //    return body[0].scrollHeight;
            //}, function (val) {
            //    if (val) {
            //        deregister();
            //        loader.remove();
            //    }
            //});

            element.addClass('ui-captcha');

            $window.grecaptcha && $window.grecaptcha.render(body[0], {

                sitekey: apiConfig.sitekey,

                callback: function (value) {
                    scope.captcha = value;
                    scope.$apply();
                },

                'expired-callback': function () {
                    scope.captcha = false;
                    scope.$apply();
                }
            });
        }
    };
}]);