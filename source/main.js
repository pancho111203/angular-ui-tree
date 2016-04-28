/**
 * @license Angular UI Tree v2.15.0
 * (c) 2010-2016. https://github.com/angular-ui-tree/angular-ui-tree
 * License: MIT
 */
(function () {
  'use strict';

  angular.module('ui.tree', [])
    .constant('treeConfig', {
          treeClass: 'angular-ui-tree',
          emptyTreeClass: 'angular-ui-tree-empty',
          hiddenClass: 'angular-ui-tree-hidden',
          nodesClass: 'angular-ui-tree-nodes',
          nodeClass: 'angular-ui-tree-node',
          handleClass: 'angular-ui-tree-handle',
          placeholderClass: 'angular-ui-tree-placeholder',
          placeHoldersWrapperClass: 'angular-ui-tree-placeholders-wrapper',
          dragClass: 'angular-ui-tree-drag',
          dragWrapperClass: 'angular-ui-tree-drag-wrapper',
          selectedClass: 'angular-ui-tree-node-selected',
          dragThreshold: 3,
          levelThreshold: 30,
          defaultCollapsed: false
    });

})();
