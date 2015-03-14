var controllers = require('../../core/controllers');

controllers.controller('loginController', ['$scope', '$state', loginController]);

function loginController ($scope, $state) {

    $scope.isRegistration = $state.current.name === 'sign-up';

    $scope.submit = function () {
        console.log(1);
    }
}