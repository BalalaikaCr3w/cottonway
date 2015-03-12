var app = angular.module('cottonway', [
    'vxWamp',
    "cottonwayControllers"]);

app.config(function($wampProvider) {
    $wampProvider.init({
        url: 'wss://cottonway.club/ws/',
        realm: 'realm1'
    });
});

app.run(function($wamp){
    $wamp.open();
});

app.factory('errors',function(){
    var errorDesc = {
        1: 'Ошибка'
    };
    
    return {
        check: function(r) {
            if (r.callStatus !== 0) {
                throw errorDesc[r.callStatus];
            }
        }
    };
});
