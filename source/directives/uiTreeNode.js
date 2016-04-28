(function () {
    'use strict';

    angular.module('ui.tree')

        .directive('uiTreeNode', ['treeConfig', 'UiTreeHelper', '$window', '$document', '$timeout', '$q', '$rootElement', '$filter',
            function (treeConfig, UiTreeHelper, $window, $document, $timeout, $q, $rootElement, $filter) {
                return {
                    require: ['^uiTreeNodes', '^uiTree'],
                    restrict: 'A',
                    controller: 'TreeNodeController',
                    link: function (scope, element, attrs, controllersArr) {
                        // todo startPos is unused
                        var config = {},
                            hasTouch = 'ontouchstart' in window,
                            startPos, firstMoving, pos,
                            placeElm, hiddenPlaceElm, dragElm,
                            treeScope = null,
                            elements, // As a parameter for callbacks
                            dragDelaying = true,
                            dragStarted = false,
                            dragTimer = null,
                            body = document.body,
                            html = document.documentElement,
                            document_height,
                            document_width,
                            dragStart,
                            tagName,
                            dragMove,
                            dragEnd,
                            dragStartEvent,
                            dragMoveEvent,
                            dragEndEvent,
                            dragCancelEvent,
                            dragDelay,
                            bindDragStartEvents,
                            bindDragMoveEvents,
                            unbindDragMoveEvents,
                            keydownHandler,
                            outOfBounds,
                            isHandleChild,
                            el;



                        angular.extend(config, treeConfig);
                        if (config.nodeClass) {
                            element.addClass(config.nodeClass);
                        }
                        scope.init(controllersArr);

                        if(!scope || !scope.$treeScope){
                            console.log('FATAL ERROR: scope of element or tree not defined');
                            return;
                        }

                        scope.collapsed = !!UiTreeHelper.getNodeAttribute(scope, 'collapsed') || treeConfig.defaultCollapsed;
                        scope.sourceOnly = scope.nodropEnabled || scope.$treeScope.nodropEnabled;

                        scope.$watch(attrs.collapsed, function (val) {
                            if ((typeof val) == 'boolean') {
                                scope.collapsed = val;
                            }
                        });

                        scope.$watch('collapsed', function (val) {
                            UiTreeHelper.setNodeAttribute(scope, 'collapsed', val);
                            attrs.$set('collapsed', val);
                        });

                        scope.$on('angular-ui-tree:collapse-all', function () {
                            scope.collapsed = true;
                        });

                        scope.$on('angular-ui-tree:expand-all', function () {
                            scope.collapsed = false;
                        });

                        scope.selected = !!UiTreeHelper.getNodeAttribute(scope, 'selected');

                        scope.$watch(attrs[treeConfig.selectedClass], function (val) {
                            scope.selected = angular.isDefined(val);
                        });
                        scope.$watch('selected', function (val) {
                            UiTreeHelper.setNodeAttribute(scope, 'selected', val);
                            attrs.$set(treeConfig.selectedClass, val);
                        });

                        var toggleSelect = function (e) {
                            e.preventDefault();
                            e.stopPropagation();


                            if (!checkParentSelect(scope)) {
                                removeChildSelect();
                                scope.$apply(scope.toggleSelected);
                            }
                        };

                        var checkParentSelect = function (elementScope, count) {
                            elementScope = (angular.isUndefined(elementScope)) ? scope : elementScope;
                            count = (angular.isUndefined(count)) ? 0 : count;

                            var selected = false;
                            if (elementScope !== null) {
                                if (!selected && angular.isDefined(elementScope.$parent)) {
                                    selected = checkParentSelect(elementScope.$parent, count + 1);
                                }

                                if (!selected && count > 0) {
                                    selected = (angular.isDefined(elementScope.selected)) ? elementScope.selected : false;
                                }

                            }
                            return selected;
                        };

                        var removeChildSelect = function(){
                            removeChildSelectRecursive(scope);
                            scope.$treeScope.applyDeselectTransaction();
                        };

                        var removeChildSelectRecursive = function (elementScope) {
                            elementScope = (angular.isUndefined(elementScope)) ? scope : elementScope;
                            if (elementScope.hasChild()) {
                                angular.forEach(elementScope.childNodes(), function (childNodeScope) {
                                    if(childNodeScope){
                                        childNodeScope.deselectTransaction();
                                        removeChildSelectRecursive(childNodeScope);
                                    }
                                });
                            }
                        };


                        /**
                         * Called when the user has grabbed a node and started dragging it
                         * @param e
                         */
                        dragStart = function (e) {
                            // disable right click
                            if (!hasTouch && (e.button === 2 || e.which === 3)) {
                                return;
                            }

                            // event has already fired in other scope
                            if (e.uiTreeDragging || (e.originalEvent && e.originalEvent.uiTreeDragging)) {
                                return;
                            }

                            // the node being dragged
                            var eventElm = angular.element(e.target),
                                isHandleChild, cloneElm, eventElmTagName, tagName,
                                eventObj, tdElm, hStyle,
                                isTreeNode,
                                isTreeNodeHandle;
                            // if the target element is a child element of a ui-tree-handle,
                            // use the containing handle element as target element
                            isHandleChild = UiTreeHelper.treeNodeHandlerContainerOfElement(eventElm);
                            if (isHandleChild) {
                                eventElm = angular.element(isHandleChild);
                            }


                            cloneElm = element.clone();
                            isTreeNode = UiTreeHelper.elementIsTreeNode(eventElm);
                            isTreeNodeHandle = UiTreeHelper.elementIsTreeNodeHandle(eventElm);

                            if (!isTreeNode && !isTreeNodeHandle) {
                                return;
                            }

                            if (isTreeNode && UiTreeHelper.elementContainsTreeNodeHandler(eventElm)) {
                                return;
                            }

                            eventElmTagName = eventElm.prop('tagName').toLowerCase();
                            if (eventElmTagName == 'input' ||
                                eventElmTagName == 'textarea' ||
                                eventElmTagName == 'button' ||
                                eventElmTagName == 'select') { // if it's a input or button, ignore it
                                return;
                            }

                            // check if it or it's parents has a 'data-nodrag' attribute
                            el = angular.element(e.target);
                            while (el && el[0] && el[0] !== element) {
                                if (UiTreeHelper.nodrag(el)) { // if the node mark as `nodrag`, DONOT drag it.
                                    return;
                                }
                                el = el.parent();
                            }

                            if (!scope.beforeDrag(scope)) {
                                return;
                            }

                            e.uiTreeDragging = true; // stop event bubbling
                            if (e.originalEvent) {
                                e.originalEvent.uiTreeDragging = true;
                            }
                            e.preventDefault();
                            eventObj = UiTreeHelper.eventObj(e);

                            firstMoving = true;

                            tagName = element.prop('tagName');

                            if (tagName.toLowerCase() === 'tr') {
                                placeElm = angular.element($window.document.createElement(tagName));
                                tdElm = angular.element($window.document.createElement('td'))
                                    .addClass(config.placeholderClass)
                                    .attr('colspan', element[0].children.length);
                                placeElm.append(tdElm);
                            } else {
                                placeElm = angular.element($window.document.createElement(tagName))
                                    .addClass(config.placeholderClass);
                            }
                            hiddenPlaceElm = angular.element($window.document.createElement(tagName));
                            if (config.hiddenClass) {
                                //hiddenPlaceElm.addClass(config.hiddenClass);
                            }

                            pos = UiTreeHelper.positionStarted(eventObj, element);
                            dragElm = angular.element($window.document.createElement(scope.$parentNodesScope.$element.prop('tagName')))
                                .addClass(scope.$parentNodesScope.$element.attr('class')).addClass(config.dragClass);

                            // TODO maybe there are edge cases where this fails

                            if (!scope.selected) {
                                if (config.hiddenClass) {
                                    angular.forEach(scope.$treeScope.selecteds, function (selectedElement) {
                                        //hiddenPlaceElm.addClass(config.hiddenClass);
                                        var selectedElementScope = selectedElement.$scope;
                                        selectedElementScope.deselectTransaction();
                                    });
                                    scope.$treeScope.applyDeselectTransaction();

                                    scope.$treeScope.selecteds = [];
                                }
                            }


                            if (angular.isDefined(scope.$treeScope.selecteds) && scope.$treeScope.selecteds.length > 1) {
                                scope.$treeScope.selecteds = $filter('orderBy')(scope.$treeScope.selecteds, function (selectedElement) {
                                    return UiTreeHelper.offset(angular.element(selectedElement)).top;
                                }, false);
                            }



                            if (angular.isDefined(scope.$treeScope.selecteds) && scope.$treeScope.selecteds.length > 0) {
                                // If moving more than one element

                                var orderedElements = [];

                                placeElm = angular.element($window.document.createElement('div')).addClass(treeConfig.placeHoldersWrapperClass);

                                hiddenPlaceElm = angular.element($window.document.createElement('div'));


                                dragElm = angular.element($window.document.createElement('div')).addClass(treeConfig.dragWrapperClass);

                                pos = UiTreeHelper.positionStarted(eventObj, scope.$treeScope.selecteds[0]);

                                var firstElement = angular.element(scope.$treeScope.selecteds[0]);
                                var firstElementOffset = angular.copy(UiTreeHelper.offset(firstElement));

                                angular.forEach(scope.$treeScope.selecteds, function (selected, index) {
                                    var selectedElement = angular.element(selected);
                                    var selectedElementScope = selected.$scope;

                                    selectedElementScope.$dragInfo = UiTreeHelper.dragInfo(selectedElementScope);

                                    var selectedElementHeight = UiTreeHelper.height(selectedElement);
                                    var selectedElementWidth = UiTreeHelper.width(selectedElement);

                                    var selectedElementPlace;

                                    var tagName = selectedElement.prop('tagName');
                                    if (tagName.toLowerCase() === 'tr') {
                                        selectedElementPlace = angular.element($window.document.createElement(tagName));
                                        var tdElm = angular.element($window.document.createElement('td')).addClass(config.placeholderClass);
                                        selectedElementPlace.append(tdElm);
                                    } else {
                                        selectedElementPlace = angular.element($window.document.createElement(tagName)).addClass(config.placeholderClass);
                                    }

                                    selectedElementPlace.css('height', selectedElementHeight + 'px');
                                    placeElm.append(selectedElementPlace);

                                    var selectedElementHiddenPlace = angular.element($window.document.createElement(tagName));
                                    if (config.hiddenClass) {
                                        selectedElementHiddenPlace.addClass(config.hiddenClass);
                                    }
                                    hiddenPlaceElm.append(selectedElementHiddenPlace);

                                    var selectedElementDrag = angular.element($window.document.createElement(selectedElementScope.$parentNodesScope.$element.prop('tagName')))
                                        .addClass(selectedElementScope.$parentNodesScope.$element.attr('class'));

                                    selectedElementDrag.css('width', selectedElementWidth + 'px');

                                    var clone = selectedElement.clone();
                                    selectedElementDrag.append(clone);
                                    if (!selectedElementScope.$treeScope.cloneEnabled) {
                                        selectedElement.addClass(config.hiddenClass);
                                    }

                                    dragElm.append(selectedElementDrag);
                                    // Prevents cursor to change rapidly in Opera 12.16 and IE when dragging an element
                                    var hStyle = (scope.$element[0].querySelector('.angular-ui-tree-handle') || scope.$element[0]).currentStyle;
                                    if (hStyle) {
                                        document.body.setAttribute('ui-tree-cursor', $document.find('body').css('cursor') || '');
                                        $document.find('body').css({cursor: hStyle.cursor + '!important'});
                                    }
                                });
                                dragElm.css('z-index', 9999).addClass(config.dragClass);

                                firstElement.parent()[0].insertBefore(placeElm[0], firstElement[0]);
                                firstElement.parent()[0].insertBefore(hiddenPlaceElm[0], firstElement[0]);

                                $document.find('body').append(dragElm);
                                dragElm.css({
                                    left: firstElementOffset.left + 'px',
                                    top: firstElementOffset.top + 'px'
                                });
                                elements = {
                                    placeholder: placeElm,
                                    dragging: dragElm
                                };
                                bindDragMoveEvents();


                                angular.forEach(scope.$treeScope.selecteds, function(selectedElement) {
                                    var selectedElementScope = selectedElement.$scope;

                                    selectedElementScope.$apply(function() {
                                        scope.$callbacks.dragStart(selectedElementScope.$dragInfo.eventArgs(elements, pos));
                                    });
                                });

                            }else{

                                placeElm.css('height', UiTreeHelper.height(element) + 'px');
                                dragElm.css('width', UiTreeHelper.width(element) + 'px');
                                dragElm.css('z-index', 9999);


                                scope.$dragInfo = UiTreeHelper.dragInfo(scope);

                                scope.$treeScope.selecteds = [scope.$element];

                                // Prevents cursor to change rapidly in Opera 12.16 and IE when dragging an element
                                hStyle = (element[0].querySelector('.angular-ui-tree-handle') || element[0]).currentStyle;
                                if (hStyle) {
                                    document.body.setAttribute('ui-tree-cursor', $document.find('body').css('cursor') || '');
                                    $document.find('body').css({'cursor': hStyle.cursor + '!important'});
                                }

                                if (scope.sourceOnly) {
                                    placeElm.css('display', 'none');
                                }
                                element.after(placeElm);
                                element.after(hiddenPlaceElm);
                                if (scope.$dragInfo.isClone() && scope.sourceOnly) {
                                    dragElm.append(cloneElm);
                                } else {
                                    dragElm.append(element);
                                }

                                $rootElement.append(dragElm);

                                dragElm.css({
                                    'left': eventObj.pageX - pos.offsetX + 'px',
                                    'top': eventObj.pageY - pos.offsetY + 'px'
                                });
                                elements = {
                                    placeholder: placeElm,
                                    dragging: dragElm
                                };

                                bindDragMoveEvents();
                                // Fire dragStart callback
                                angular.forEach(scope.$treeScope.selecteds, function(selectedElement){
                                    scope.$apply(function () {
                                        scope.$treeScope.$callbacks.dragStart(selectedElement.$scope.$dragInfo.eventArgs(elements, pos));
                                    });
                                });

                            }
                            document_height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
                            document_width = Math.max(body.scrollWidth, body.offsetWidth, html.clientWidth, html.scrollWidth, html.offsetWidth);
                        };

                        dragMove = function (e) {
                            var eventObj = UiTreeHelper.eventObj(e),
                                prev,
                                next,
                                leftElmPos,
                                topElmPos,
                                top_scroll,
                                bottom_scroll,
                                target,
                                decrease,
                                targetX,
                                targetY,
                                displayElm,
                                targetNode,
                                targetElm,
                                isEmpty,
                                scrollDownBy,
                                targetOffset,
                                targetBefore;

                            if (dragElm) {
                                e.preventDefault();

                                if ($window.getSelection) {
                                    $window.getSelection().removeAllRanges();
                                } else if ($window.document.selection) {
                                    $window.document.selection.empty();
                                }

                                leftElmPos = eventObj.pageX - pos.offsetX;
                                topElmPos = eventObj.pageY - pos.offsetY;

                                //dragElm can't leave the screen on the left
                                if (leftElmPos < 0) {
                                    leftElmPos = 0;
                                }

                                //dragElm can't leave the screen on the top
                                if (topElmPos < 0) {
                                    topElmPos = 0;
                                }

                                //dragElm can't leave the screen on the bottom
                                if ((topElmPos + 10) > document_height) {
                                    topElmPos = document_height - 10;
                                }

                                //dragElm can't leave the screen on the right
                                if ((leftElmPos + 10) > document_width) {
                                    leftElmPos = document_width - 10;
                                }

                                dragElm.css({
                                    'left': leftElmPos + 'px',
                                    'top': topElmPos + 'px'
                                });

                                top_scroll = window.pageYOffset || $window.document.documentElement.scrollTop;
                                bottom_scroll = top_scroll + (window.innerHeight || $window.document.clientHeight || $window.document.clientHeight);

                                // to scroll down if cursor y-position is greater than the bottom position the vertical scroll
                                if (bottom_scroll < eventObj.pageY && bottom_scroll < document_height) {
                                    scrollDownBy = Math.min(document_height - bottom_scroll, 10);
                                    window.scrollBy(0, scrollDownBy);
                                }

                                // to scroll top if cursor y-position is less than the top position the vertical scroll
                                if (top_scroll > eventObj.pageY) {
                                    window.scrollBy(0, -10);
                                }

                                UiTreeHelper.positionMoved(e, pos, firstMoving);
                                if (firstMoving) {
                                    firstMoving = false;
                                    return;
                                }

                                // check if add it as a child node first
                                // todo decrease is unused
                                decrease = (UiTreeHelper.offset(dragElm).left - UiTreeHelper.offset(placeElm).left) >= config.threshold;

                                targetX = eventObj.pageX - ($window.pageXOffset ||
                                    $window.document.body.scrollLeft ||
                                    $window.document.documentElement.scrollLeft) -
                                    ($window.document.documentElement.clientLeft || 0);

                                targetY = eventObj.pageY - ($window.pageYOffset ||
                                    $window.document.body.scrollTop ||
                                    $window.document.documentElement.scrollTop) -
                                    ($window.document.documentElement.clientTop || 0);

                                // Select the drag target. Because IE does not support CSS 'pointer-events: none', it will always
                                // pick the drag element itself as the target. To prevent this, we hide the drag element while
                                // selecting the target.
                                if (angular.isFunction(dragElm.hide)) {
                                    dragElm.hide();
                                } else {
                                    displayElm = dragElm[0].style.display;
                                    dragElm[0].style.display = 'none';
                                }

                                // when using elementFromPoint() inside an iframe, you have to call
                                // elementFromPoint() twice to make sure IE8 returns the correct value
                                $window.document.elementFromPoint(targetX, targetY);

                                targetElm = angular.element($window.document.elementFromPoint(targetX, targetY));

                                // if the target element is a child element of a ui-tree-handle,
                                // use the containing handle element as target element
                                isHandleChild = UiTreeHelper.treeNodeHandlerContainerOfElement(targetElm);
                                if (isHandleChild) {
                                    targetElm = angular.element(isHandleChild);
                                }

                                if (angular.isFunction(dragElm.show)) {
                                    dragElm.show();
                                } else {
                                    dragElm[0].style.display = displayElm;
                                }

                                outOfBounds = !UiTreeHelper.elementIsTreeNodeHandle(targetElm) && !UiTreeHelper.elementIsTreeNode(targetElm) && !UiTreeHelper.elementIsTreeNodes(targetElm) && !UiTreeHelper.elementIsTree(targetElm) && !UiTreeHelper.elementIsPlaceholder(targetElm) && !UiTreeHelper.elementIsPlaceholderWrapper(targetElm);

                                // Detect out of bounds condition, update drop target display, and prevent drop
                                if (outOfBounds) {

                                    // Remove the placeholder
                                    placeElm.remove();

                                    // If the target was an empty tree, replace the empty element placeholder
                                    if (treeScope) {
                                        treeScope.resetEmptyElement();
                                        treeScope = null;
                                    }
                                }

                                // move horizontal


                                if (pos.dirAx && pos.distAxX >= config.levelThreshold) {
                                    pos.distAxX = 0;
                                    // increase horizontal level if previous sibling exists and is not collapsed
                                    if (pos.distX > 0) {


                                        prev = scope.$treeScope.selecteds[0].$scope.$dragInfo.prev();
                                        if (prev && !prev.collapsed
                                            && prev.accept(scope, prev.childNodesCount())) {
                                            prev.$childNodesScope.$element.append(placeElm);
                                            angular.forEach(scope.$treeScope.selecteds, function(selectedElement, index){
                                                selectedElement.$scope.$dragInfo.moveTo(prev.$childNodesScope, prev.childNodes(), prev.childNodesCount()+index);
                                            });

                                        }
                                    }

                                    // decrease horizontal level
                                    if (pos.distX < 0) {
                                        // we can't decrease a level if an item preceeds the current one
                                        next = scope.$treeScope.selecteds[0].$scope.$dragInfo.next();
                                        if (!next) {
                                            target = scope.$treeScope.selecteds[0].$scope.$dragInfo.parentNode(); // As a sibling of it's parent node
                                            if (target
                                                && target.$parentNodesScope.accept(scope, target.index() + 1)) {
                                                target.$element.after(placeElm);
                                                angular.forEach(scope.$treeScope.selecteds, function(selectedElement, index){
                                                    selectedElement.$scope.$dragInfo.moveTo(target.$parentNodeScope, target.siblings(), target.index()+1+index);
                                                });

                                            }
                                        }
                                    }
                                }

                                // move vertical
                                if (!pos.dirAx) {
                                    if (UiTreeHelper.elementIsTree(targetElm)) {
                                        targetNode = targetElm.controller('uiTree').scope;
                                    } else if (UiTreeHelper.elementIsTreeNodeHandle(targetElm)) {
                                        targetNode = targetElm.controller('uiTreeHandle').scope;
                                    } else if (UiTreeHelper.elementIsTreeNode(targetElm)) {
                                        targetNode = targetElm.controller('uiTreeNode').scope;
                                    } else if (UiTreeHelper.elementIsTreeNodes(targetElm)) {
                                        targetNode = targetElm.controller('uiTreeNodes').scope;
                                    } else if (UiTreeHelper.elementIsPlaceholder(targetElm)) {
                                        targetNode = targetElm.controller('uiTreeNodes').scope;
                                    } else if (UiTreeHelper.elementIsPlaceholderWrapper(targetElm)) {
                                        targetNode = targetElm.controller('uiTreeNodes').scope;
                                    } else if (targetElm.controller('uiTreeNode')) {
                                        // is a child element of a node
                                        targetNode = targetElm.controller('uiTreeNode').scope;
                                    }



                                    // check it's new position
                                    isEmpty = false;
                                    if (!targetNode) {
                                        return;
                                    }

                                    // Show the placeholder if it was hidden for nodrop-enabled and this is a new tree
                                    if (targetNode.$treeScope && !targetNode.$parent.nodropEnabled && !targetNode.$treeScope.nodropEnabled) {
                                        placeElm.css('display', '');
                                    }

                                    if (targetNode.$type == 'uiTree' && targetNode.dragEnabled) {
                                        isEmpty = targetNode.isEmpty(); // Check if it's empty tree
                                    }

                                    if (targetNode.$type == 'uiTreeHandle') {
                                        targetNode = targetNode.$nodeScope;
                                    }

                                    if (targetNode.$type != 'uiTreeNode'
                                        && !isEmpty) { // Check if it is a uiTreeNode or it's an empty tree
                                        return;
                                    }

                                    // if placeholder move from empty tree, reset it.
                                    if (treeScope && placeElm.parent()[0] != treeScope.$element[0]) {
                                        treeScope.resetEmptyElement();
                                        treeScope = null;
                                    }

                                    if (isEmpty) { // it's an empty tree
                                        treeScope = targetNode;
                                        if (targetNode.$nodesScope.accept(scope, 0)) {
                                            targetNode.place(placeElm);
                                            angular.forEach(scope.$treeScope.selecteds, function(selectedElement, index){
                                                selectedElement.$scope.$dragInfo.moveTo(targetNode.$nodesScope, targetNode.$nodesScope.childNodes(), index);
                                            });

                                        }
                                    } else if (targetNode.dragEnabled()) { // drag enabled
                                        targetElm = targetNode.$element; // Get the element of ui-tree-node
                                        targetOffset = UiTreeHelper.offset(targetElm);
                                        targetBefore = targetNode.horizontal ? eventObj.pageX < (targetOffset.left + UiTreeHelper.width(targetElm) / 2)
                                            : eventObj.pageY < (targetOffset.top + UiTreeHelper.height(targetElm) / 2);

                                        if (targetNode.$parentNodesScope.accept(scope, targetNode.index())) {

                                            if (targetBefore) {
                                                targetElm[0].parentNode.insertBefore(placeElm[0], targetElm[0]);

                                                angular.forEach(scope.$treeScope.selecteds, function(selectedElement, index){
                                                    selectedElement.$scope.$dragInfo.moveTo(targetNode.$parentNodesScope, targetNode.siblings(), targetNode.index()+index);
                                                });
                                            } else {
                                                targetElm.after(placeElm);
                                                angular.forEach(scope.$treeScope.selecteds, function(selectedElement, index){
                                                    selectedElement.$scope.$dragInfo.moveTo(targetNode.$parentNodesScope, targetNode.siblings(), targetNode.index()+index+1);
                                                });
                                            }
                                        } else if (targetNode.accept(scope, targetNode.childNodesCount())) { // we have to check if it can add the dragging node as a child
                                            targetNode.$childNodesScope.$element.append(placeElm);
                                            angular.forEach(scope.$treeScope.selecteds, function(selectedElement, index){
                                                selectedElement.$scope.$dragInfo.moveTo(targetNode.$childNodesScope,  targetNode.childNodes(), targetNode.childNodesCount()+index);
                                            });
                                        } else {
                                            outOfBounds = true;
                                        }
                                    }
                                }

                                scope.$apply(function () {
                                    angular.forEach(scope.$treeScope.selecteds, function(selectedElement){
                                        scope.$treeScope.$callbacks.dragMove(selectedElement.$scope.$dragInfo.eventArgs(elements, pos));
                                    });

                                });
                            }
                        };

                        dragEnd = function (e) {
                            var dragEventArgs = scope.$treeScope.selecteds[0].$scope.$dragInfo.eventArgs(elements, pos);
                            e.preventDefault();
                            unbindDragMoveEvents();

                            scope.$treeScope.$apply(function () {
                                $q.when(scope.$treeScope.$callbacks.beforeDrop(dragEventArgs))
                                    // promise resolved (or callback didn't return false)
                                    .then(function (allowDrop) {

                                        if (allowDrop !== false && scope.$$allowNodeDrop && !outOfBounds) {
                                            angular.forEach(scope.$treeScope.selecteds, function(selectedElement, index){
                                                selectedElement.$scope.$dragInfo.apply();
                                                scope.$treeScope.$callbacks.dropped(selectedElement.$scope.$dragInfo.eventArgs(elements, pos));
                                            });
                                            // fire the dropped callback only if the move was successful

                                        } else { // drop canceled - revert the node to its original position
                                            bindDragStartEvents();
                                        }
                                    })
                                    // promise rejected - revert the node to its original position
                                    .catch(function () {
                                        bindDragStartEvents();
                                    })
                                    .finally(function () {


                                        hiddenPlaceElm.replaceWith(scope.$element);
                                        placeElm.remove();

                                        if (dragElm) { // drag element is attached to the mouse pointer
                                            dragElm.remove();
                                            dragElm = null;
                                        }

                                        scope.$$allowNodeDrop = false;


                                        angular.forEach(scope.$treeScope.selecteds, function(selectedElement, index){
                                            selectedElement.removeClass(config.hiddenClass);
                                            scope.$treeScope.$callbacks.dragStop(selectedElement.$scope.$dragInfo.eventArgs(elements, pos));
                                            selectedElement.$scope.deselectTransaction();
                                            selectedElement.$scope.$dragInfo = null;
                                        });
                                        scope.$treeScope.applyDeselectTransaction();
                                        scope.$treeScope.selecteds = [];

                                        // Restore cursor in Opera 12.16 and IE
                                        var oldCur = document.body.getAttribute('ui-tree-cursor');
                                        if (oldCur !== null) {
                                            $document.find('body').css({'cursor': oldCur});
                                            document.body.removeAttribute('ui-tree-cursor');
                                        }
                                    });
                            });
                        };

                        dragStartEvent = function (e) {
                            if (scope.dragEnabled()) {
                                dragStart(e);
                            }
                        };

                        dragMoveEvent = function (e) {
                            dragMove(e);
                        };

                        dragEndEvent = function (e) {
                            scope.$$allowNodeDrop = true;
                            dragEnd(e);
                        };

                        dragCancelEvent = function (e) {
                            dragEnd(e);
                        };

                        dragDelay = (function () {
                            var to;

                            return {
                                exec: function (fn, ms) {
                                    if (!ms) {
                                        ms = 0;
                                    }
                                    this.cancel();
                                    to = $timeout(fn, ms);
                                },
                                cancel: function () {
                                    $timeout.cancel(to);
                                }
                            };
                        })();

                        /**
                         * Binds the mouse/touch events to enable drag start for this node
                         */
                        bindDragStartEvents = function () {
                            element.bind('touchstart mousedown', function (e) {
                                if (!scope.$treeScope.$multiSelect) {
                                    dragDelay.exec(function () {
                                        dragStartEvent(e);
                                    }, scope.dragDelay || 0);
                                } else {
                                    toggleSelect(e);
                                }

                            });
                            element.bind('touchend touchcancel mouseup', function () {
                                dragDelay.cancel();
                            });
                        };
                        bindDragStartEvents();

                        /**
                         * Binds mouse/touch events that handle moving/dropping this dragged node
                         */
                        bindDragMoveEvents = function () {
                            angular.element($document).bind('touchend', dragEndEvent);
                            angular.element($document).bind('touchcancel', dragEndEvent);
                            angular.element($document).bind('touchmove', dragMoveEvent);
                            angular.element($document).bind('mouseup', dragEndEvent);
                            angular.element($document).bind('mousemove', dragMoveEvent);
                            angular.element($document).bind('mouseleave', dragCancelEvent);
                        };

                        /**
                         * Unbinds mouse/touch events that handle moving/dropping this dragged node
                         */
                        unbindDragMoveEvents = function () {
                            angular.element($document).unbind('touchend', dragEndEvent);
                            angular.element($document).unbind('touchcancel', dragEndEvent);
                            angular.element($document).unbind('touchmove', dragMoveEvent);
                            angular.element($document).unbind('mouseup', dragEndEvent);
                            angular.element($document).unbind('mousemove', dragMoveEvent);
                            angular.element($document).unbind('mouseleave', dragCancelEvent);
                        };

                        keydownHandler = function (e) {
                            if (e.keyCode == 27) {
                                scope.$$allowNodeDrop = false;
                                dragEnd(e);
                            }
                        };

                        angular.element($window.document).bind('keydown', keydownHandler);

                        //unbind handler that retains scope
                        scope.$on('$destroy', function () {
                            angular.element($window.document).unbind('keydown', keydownHandler);
                        });
                    }
                };
            }
        ]);

})();
