var services = require('../core/services'),
    _ = require('lodash');

// TODO: cancel functions on changing token

services.factory('tokenService', ['$q', '$rootScope', '$interval', 'pluginService',
                                  function ($q, $rootScope, $interval, pluginService) {

    var token = {
        isAvailable: false,
        isLoggedIn: false,
        certs: [],
        login: login
    };

    pluginService.onLoaded(function () {
        $interval(enumerate, 5000);
        enumerate();
    });

    function enumerate() {
        pluginService.enumerateDevices()
            .then(function (devices) {
                if (devices.length == 0) {
                    token.isAvailable = false;
                    token.certs = [];
                    delete token.serial;
                    return;
                }

                var deviceId = devices[0];

                pluginService.getDeviceInfo(deviceId, pluginService.TOKEN_INFO_SERIAL)
                    .then(function (serial) {
                        if (token.serial == serial) {
                            return;
                        }

                        token.deviceId = devices[0];
                        token.serial = serial;
                        token.isAvailable = true;
                        token.isLoggedIn = false;
                    });
            });
    }

    function login (pin) {
        return pluginService.login(token.deviceId, pin)
            .then(function () {
                token.isLoggedIn = true;

                return pluginService.enumerateCertificates(token.deviceId, pluginService.CERT_CATEGORY_USER);
            }).then(function (certIds) {
                token.certs = [];

                var prom = [];
                angular.forEach(certIds, function(certId) {
                    prom.push(pluginService.parseCertificate(token.deviceId, certId).then(getCertInfo(certId)));
                });

                function getCertInfo(certId) {
                    return function (certInfo) {
                        for (var i in certInfo.subject) {
                            if (certInfo.subject[i].rdn == "commonName") {
                                token.certs.push({
                                    certId: certId,
                                    commonName: certInfo.subject[i].value
                                });
                            }
                        }
                    };
                }

                 return $q.all(prom);
            });
    }

    return token;
}]);
