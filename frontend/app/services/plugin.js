var services = require('../core/services'),
    _ = require('lodash');

services.factory('pluginService', ['$rootScope', '$q', 'errorService', pluginService]);

function pluginService ($rootScope, $q, errorService) {

    var loadedCallbacks = [],
        wrapper = {
            isLoaded: false,
            onLoaded: onLoaded
        },
        errors = {};

    $rootScope.$watch('plugin', function (plugin) {

        if (!plugin) {
            return;
        }

        wrapper.isLoaded = true;

        errors[plugin.errorCodes.UNKNOWN_ERROR] = 'Неизвестная ошибка';
        errors[plugin.errorCodes.BAD_PARAMS] = 'Неправильные параметры';
        errors[plugin.errorCodes.DEVICE_NOT_FOUND] = 'Устройство не найдено';
        errors[plugin.errorCodes.CERTIFICATE_CATEGORY_BAD] = 'Недопустимый тип сертификата';
        errors[plugin.errorCodes.CERTIFICATE_EXISTS] = 'Сертификат уже существует на устройстве';
        errors[plugin.errorCodes.PKCS11_LOAD_FAILED] = 'Не удалось загрузить PKCS#11 библиотеку';
        errors[plugin.errorCodes.NOT_ENOUGH_MEMORY] = 'Недостаточно памяти';
        errors[plugin.errorCodes.PIN_LENGTH_INVALID] = 'Некорректная длина PIN-кода';
        errors[plugin.errorCodes.PIN_INCORRECT] = 'Некорректный PIN-код';
        errors[plugin.errorCodes.PIN_LOCKED] = 'PIN-код заблокирован';
        errors[plugin.errorCodes.PIN_CHANGED] = 'PIN-код был изменен';
        errors[plugin.errorCodes.SESSION_INVALID] = 'Состояние токена изменилось';
        errors[plugin.errorCodes.USER_NOT_LOGGED_IN] = 'Выполните вход на устройство';
        errors[plugin.errorCodes.KEY_NOT_FOUND] = 'Соответствующая сертификату ключевая пара не найдена';
        errors[plugin.errorCodes.KEY_ID_NOT_UNIQUE] = 'Идентификатор ключевой пары не уникален';
        errors[plugin.errorCodes.CERTIFICATE_NOT_FOUND] = 'Сертификат не найден';
        errors[plugin.errorCodes.CERTIFICATE_HASH_NOT_UNIQUE] = 'Хэш сертификата не уникален';
        errors[plugin.errorCodes.TOKEN_INVALID] = 'Ошибка чтения/записи устройства. Возможно, устройство было извлечено. Попробуйте выполнить enumerate';
        errors[plugin.errorCodes.BASE64_DECODE_FAILED] = 'Ошибка декодирования даных из BASE64';
        errors[plugin.errorCodes.PEM_ERROR] = 'Ошибка разбора PEM';
        errors[plugin.errorCodes.ASN1_ERROR] = 'Ошибка декодирования ASN1 структуры';
        errors[plugin.errorCodes.WRONG_KEY_TYPE] = 'Неправильный тип ключа';

        _.each(plugin, function (value, key) {

            if (_.isNumber(value)) {
                wrapper[key] = value;
                return;
            } else if (!_.isFunction(value)) {
                return;
            }

            wrapper[key] = function () {

                var defer = $q.defer(),
                    args = [].slice.call(arguments).concat(resultCallback, errorCallback);

                plugin[f].apply(plugin, args);

                return defer.promise;

                function resultCallback (result) {
                    defer.resolve(result);
                    $rootScope.$apply();
                }

                function errorCallback (code, text) {
                    errorService.custom(errors[code]);
                    defer.reject(code);
                    $rootScope.$apply();
                }
            };
        });

        _.each(loadedCallbacks, function(callback) {
            callback();
        });
    });

    function onLoaded(callback) {

        loadedCallbacks.push(callback);

        if (wrapper.isLoaded) {
            callback();
        }
    }

    return wrapper;
}

window.onPluginLoaded = function(plugin) {

    var root = angular.element(document.body).scope().$root;
    root.plugin = plugin;
    root.$apply();
};
