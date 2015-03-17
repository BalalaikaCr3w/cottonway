var controllers = require('../../core/controllers');

controllers.controller('loginController', ['$scope', '$state', '$cookies', 'apiService', loginController]);

function loginController ($scope, $state, $cookies, apiService) {

    $scope.isRegistration = $state.current.name === 'sign-up';
    $scope.form = {
        remember: true,
        captcha: false
    };

    $scope.signIn = function () {

        $scope.form.captcha && apiService.call('club.cottonway.auth.sign_in', [
            $scope.form.email,
            $scope.form.password
        ], {
            recaptcha: $scope.form.captcha
        })
            .then(success);
    };

    $scope.signUp = function () {

        $scope.form.captcha && apiService.call('club.cottonway.auth.sign_up', [
            $scope.form.email,
            $scope.form.name,
            $scope.form.password
        ], {
            recaptcha: $scope.form.captcha
        })
            .then(success);
    };

    function success (response) {

        $scope.setUser(response.user);
        if ($scope.form.remember) {
            $cookies.backend_auth_data = response.authData;
        }
        $state.go('quest');
    }
}