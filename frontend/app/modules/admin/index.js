var controllers = require('../../core/controllers');

controllers.controller('adminController', ['$scope', 'apiService','modalService', adminController]);

function adminController ($scope, apiService,modalService) {

	load();

    $scope.open = function (item) {

        modalService({
            $scope: $scope,
            title: item.title,
            template: 'app/modules/admin/modal.html',
            data: item,
            onClose: function () {
                item.error = false;
            }
        });
    };

   

    $scope.save = function(task)
    {

    	task.categories = typeof(task.categories) == 'string'?task.categories.split(','):task.categories;
    	apiService.call("club.cottonway.admin.update_task",[task],{},
    	{
    		silent: true
    	})
    	.catch(function (err) {

                var def = {
                    errorMessage: 'Произошла ошибка'
                };

                if (!err || err.callStatus !== 0) {
                    task.error = _.extend({}, def, err);
                }
            });
    	
    }


function load(){

	
	apiService.call("club.cottonway.admin.tasks")
	.then(function(response){
		$scope.tasks = response.tasks;
	})



}
}