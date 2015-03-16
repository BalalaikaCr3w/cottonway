var controllers = require('../../core/controllers');

controllers.controller('loginController', ['$scope', '$state', '$cookies', 'dataService', 'apiService', loginController]);

function loginController ($scope, $state, $cookies, dataService, apiService) {

    $scope.isRegistration = $state.current.name === 'sign-up';
    $scope.form = {
        remember: true
    };

    $scope.signIn = function () {

        apiService.call('club.cottonway.auth.sign_in', [
            $scope.form.email,
            $scope.form.password
        ])
            .then(success);
    };

    $scope.signUp = function () {

        apiService.call('club.cottonway.auth.sign_up', [
            $scope.form.email,
            $scope.form.name,
            $scope.form.password
        ])
            .then(success);
    };

    function success (response) {

        dataService('user').user = response.user;
        if ($scope.form.remember) {
            $cookies.backend_auth_data = response.authData;
        }
        $state.go('quest');
    }
}