(function () {
  'use strict';

  angular.module('ui.tree')

    .controller('TreeController', ['$scope', '$element',
      function ($scope, $element) {
        this.scope = $scope;

        $scope.$element = $element;
        $scope.$nodesScope = null; // root nodes
        $scope.$type = 'uiTree';
        $scope.$emptyElm = null;
        $scope.$callbacks = null;

        $scope.dragEnabled = true;
        $scope.emptyPlaceholderEnabled = true;
        $scope.maxDepth = 0;
        $scope.dragDelay = 0;
        $scope.cloneEnabled = false;
        $scope.nodropEnabled = false;

        $scope.selecteds = [];
        $scope.$multiSelectKey = undefined;
        $scope.$multiSelect = false;
        $scope.$toDeselect = [];

        // Check if it's a empty tree
        $scope.isEmpty = function () {
          return ($scope.$nodesScope && $scope.$nodesScope.$modelValue
          && $scope.$nodesScope.$modelValue.length === 0);
        };

        // add placeholder to empty tree
        $scope.place = function (placeElm) {
          $scope.$nodesScope.$element.append(placeElm);
          $scope.$emptyElm.remove();
        };

        this.resetEmptyElement = function () {
          if ((!$scope.$nodesScope.$modelValue || $scope.$nodesScope.$modelValue.length === 0) &&
            $scope.emptyPlaceholderEnabled) {
            $element.append($scope.$emptyElm);
          } else {
            $scope.$emptyElm.remove();
          }
        };

        $scope.applyDeselectTransaction = function(){
          angular.forEach($scope.$toDeselect, function(scope){
            scope.deselect();
          });
          $scope.$toDeselect = [];
        };

        $scope.resetEmptyElement = this.resetEmptyElement;
      }
    ]);
})();
