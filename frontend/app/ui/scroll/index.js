var directives = require('../../core/directives');

directives.directive('uiScroll', [function () {

    return {
        restrict: 'A',
        scope: {
            options: '=uiScroll'
        },
        link: function (scope, element, attrs) {

            var options = scope.options || {};

            scope.$watch(function () {

                return element.text();
            }, function () {

                scope.$applyAsync(function () {

                    var duration = options.static ? 0 : 400;

                    options.static && element.css('visibility', 'hidden');

                    element.scrollTop(element[0].scrollHeight, duration)
                        .then(function () {

                            element.css('visibility', 'visible');
                        });
                });
            });
        }
    };
}]);