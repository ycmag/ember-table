/* jshint ignore:start */

/* jshint ignore:end */

define('dummy/app', ['exports', 'ember', 'ember/resolver', 'ember/load-initializers', 'dummy/config/environment'], function (exports, Ember, Resolver, loadInitializers, config) {

  'use strict';

  Ember['default'].MODEL_FACTORY_INJECTIONS = true;

  var App = Ember['default'].Application.extend({
    modulePrefix: config['default'].modulePrefix,
    podModulePrefix: config['default'].podModulePrefix,
    Resolver: Resolver['default']
  });

  loadInitializers['default'](App, config['default'].modulePrefix);

  exports['default'] = App;

});
define('dummy/components/configurable-table', ['exports', 'ember', 'ember-table/components/ember-table'], function (exports, Ember, TableComponent) {

  'use strict';

  exports['default'] = TableComponent['default'].extend({
    layoutName: 'components/ember-table',
    parentWidthObserver: Ember['default'].observer(function () {
      return this.onResizeEnd();
    }, 'parentWidth')
  });

});
define('dummy/components/ember-table', ['exports', 'ember-table/components/ember-table'], function (exports, EmberTable) {

	'use strict';

	exports['default'] = EmberTable['default'];

});
define('dummy/components/financial-table', ['exports', 'ember', 'ember-table/components/ember-table', 'ember-table/models/column-definition', 'dummy/views/financial-table-tree-row', 'dummy/utils/number-format'], function (exports, Ember, TableComponent, ColumnDefinition, FinancialTableTreeRow, NumberFormatHelpers) {

  'use strict';

  exports['default'] = TableComponent['default'].extend({
    // Overriding default properties
    layoutName: 'components/ember-table',
    numFixedColumns: 1,
    isCollapsed: false,
    isHeaderHeightResizable: true,
    rowHeight: 30,
    hasHeader: true,
    hasFooter: true,
    headerHeight: 70,

    // Custom properties
    sortAscending: false,
    sortColumn: null,

    /////////////////////////////////////////////////////////////////////////////
    // Data conversions
    /////////////////////////////////////////////////////////////////////////////

    data: null,

    columns: Ember['default'].computed(function () {
      var data = this.get('data');
      if (!data) {
        return;
      }
      var names = this.get('data.value_factors').getEach('display_name');
      var columns = names.map(function (name, index) {
        return ColumnDefinition['default'].create({
          index: index,
          headerCellName: name,
          headerCellView: 'financial-table-header-cell',
          tableCellView: 'financial-table-cell',
          getCellContent: function getCellContent(row) {
            var object = row.get('values')[this.get('index')];
            if (object.type === 'money') {
              return NumberFormatHelpers['default'].toCurrency(object.value);
            }
            if (object.type === 'percent') {
              return NumberFormatHelpers['default'].toPercent(object.value);
            }
            return '-';
          }
        });
      });
      columns.unshiftObject(this.get('groupingColumn'));
      return columns;
    }).property('data.valueFactors.@each', 'groupingColumn'),

    groupingColumn: Ember['default'].computed(function () {
      var groupingFactors = this.get('data.grouping_factors');
      var name = groupingFactors.getEach('display_name').join(' ▸ ');
      return ColumnDefinition['default'].create({
        headerCellName: name,
        savedWidth: 400,
        isTreeColumn: true,
        isSortable: false,
        textAlign: 'text-align-left',
        headerCellView: 'financial-table-header-tree-cell',
        tableCellView: 'financial-table-tree-cell',
        contentPath: 'group_value'
      });
    }).property('data.grouping_factors.@each'),

    root: Ember['default'].computed(function () {
      var data = this.get('data');
      if (!data) {
        return;
      }
      return this.createTree(null, data.root);
    }).property('data', 'sortAscending', 'sortColumn'),

    rows: Ember['default'].computed(function () {
      var root = this.get('root');
      if (!root) {
        return Ember['default'].A();
      }
      var rows = this.flattenTree(null, root, Ember['default'].A());
      this.computeStyles(null, root);
      var maxGroupingLevel = Math.max.apply(rows.getEach('groupingLevel'));
      rows.forEach(function (row) {
        return row.computeRowStyle(maxGroupingLevel);
      });
      return rows;
    }).property('root'),

    // OPTIMIZATION HACK
    bodyContent: Ember['default'].computed(function () {
      var rows = this.get('rows');
      if (!rows) {
        return Ember['default'].A();
      }
      rows = rows.slice(1, rows.get('length'));
      return rows.filterProperty('isShowing');
    }).property('rows'),

    footerContent: Ember['default'].computed(function () {
      var rows = this.get('rows');
      if (!rows) {
        return Ember['default'].A();
      }
      return rows.slice(0, 1);
    }).property('rows'),

    orderBy: function orderBy(item1, item2) {
      var sortColumn = this.get('sortColumn');
      var sortAscending = this.get('sortAscending');
      if (!sortColumn) {
        return 1;
      }
      var value1 = sortColumn.getCellContent(item1.get('content'));
      var value2 = sortColumn.getCellContent(item2.get('content'));
      var result = Ember['default'].compare(value1, value2);
      if (sortAscending) {
        return result;
      } else {
        return -result;
      }
    },

    createTree: function createTree(parent, node) {
      var row = FinancialTableTreeRow['default'].create({ parentController: this });
      // TODO(azirbel): better map function and _this use
      var children = (node.children || []).map((function (_this) {
        return function (child) {
          return _this.createTree(row, child);
        };
      })(this));
      // TODO(Peter): Hack... only collapse table if it should collapseByDefault
      // and it is not the root. Currently the total row is the root, and if it
      // is collapse, it causes nothing to show in the table and there is no way
      // to get expand it.
      row.setProperties({
        isRoot: !parent,
        isLeaf: Ember['default'].isEmpty(children),
        content: node,
        parent: parent,
        children: children,
        groupName: node.group_name,
        isCollapsed: false
      });
      return row;
    },

    // TODO(azirbel): Don't use the word 'parent'
    flattenTree: function flattenTree(parent, node, rows) {
      rows.pushObject(node);
      (node.children || []).forEach((function (_this) {
        return function (child) {
          return _this.flattenTree(node, child, rows);
        };
      })(this));
      return rows;
    },

    computeStyles: function computeStyles(parent, node) {
      node.computeStyles(parent);
      node.get('children').forEach((function (_this) {
        return function (child) {
          _this.computeStyles(node, child);
        };
      })(this));
    },

    actions: {
      toggleTableCollapse: function toggleTableCollapse() {
        var isCollapsed = this.toggleProperty('isCollapsed');
        var children = this.get('root.children');
        if (!(children && children.get('length') > 0)) {
          return;
        }
        children.forEach(function (child) {
          return child.recursiveCollapse(isCollapsed);
        });
        return this.notifyPropertyChange('rows');
      },

      toggleCollapse: function toggleCollapse(row) {
        row.toggleProperty('isCollapsed');
        Ember['default'].run.next(this, function () {
          this.notifyPropertyChange('rows');
        });
      }
    }
  });

});
define('dummy/controllers/ajax', ['exports', 'ember', 'ember-table/models/column-definition', 'dummy/views/ajax-table-lazy-data-source'], function (exports, Ember, ColumnDefinition, AjaxTableLazyDataSource) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({
    tableColumns: Ember['default'].computed(function () {
      var avatar = ColumnDefinition['default'].create({
        savedWidth: 80,
        headerCellName: 'avatar',
        tableCellViewClass: 'ajax-image-table-cell',
        contentPath: 'avatar'
      });
      var columnNames = ['login', 'type', 'createdAt'];
      var columns = columnNames.map(function (key) {
        return ColumnDefinition['default'].create({
          savedWidth: 150,
          headerCellName: key.w(),
          contentPath: key
        });
      });
      columns.unshift(avatar);
      return columns;
    }),

    tableContent: Ember['default'].computed(function () {
      return AjaxTableLazyDataSource['default'].create({
        content: new Array(100)
      });
    })
  });

});
define('dummy/controllers/array', ['exports', 'ember'], function (exports, Ember) {

	'use strict';

	exports['default'] = Ember['default'].Controller;

});
define('dummy/controllers/bars', ['exports', 'ember', 'ember-table/models/column-definition'], function (exports, Ember, ColumnDefinition) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({
    tableColumns: Ember['default'].computed(function () {
      var colors = ['blue', 'teal', 'green', 'yellow', 'orange'];
      var firstColumn = ColumnDefinition['default'].create({
        savedWidth: 50,
        headerCellName: 'Name',
        contentPath: 'key'
      });
      var columns = colors.map(function (color, index) {
        return ColumnDefinition['default'].create({
          color: color,
          headerCellName: 'Bar',
          tableCellViewClass: 'bar-table-cell',
          contentPath: 'value' + (index + 1)
        });
      });
      columns.unshift(firstColumn);
      return columns;
    }),

    tableContent: Ember['default'].computed(function () {
      var content = [];
      for (var i = 0; i < 100; i++) {
        content.pushObject({
          key: i,
          value1: Math.random() * 80 + 10,
          value2: Math.random() * 80 + 10,
          value3: Math.random() * 80 + 10,
          value4: Math.random() * 80 + 10,
          value5: Math.random() * 80 + 10
        });
      }
      return content;
    })
  });

});
define('dummy/controllers/configurable-columns', ['exports', 'ember', 'dummy/views/configurable-column-definition'], function (exports, Ember, ConfigurableColumnDefinition) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({
    isFluid: false,
    showTable: true,

    // We bind the container width to a `parentWidth` property on the
    // `ConfigurableTableComponent`. Then we extend the table to force it to
    // handle resizes whenever the `parentWidth` changes. This is a hack - the
    // table should take care of resizing to available width on its own, but for
    // now we need this to make the demo work.
    demoTableWidth: null,

    columnMode: (function () {
      if (this.get('isFluid')) {
        return 'fluid';
      } else {
        return 'standard';
      }
    }).property('isFluid'),

    updateDemoTableWidth: function updateDemoTableWidth(newWidth) {
      this.set('demoTableWidth', newWidth);
    },

    columns: Ember['default'].computed(function () {
      var dateColumn = ConfigurableColumnDefinition['default'].create({
        textAlign: 'text-align-left',
        headerCellName: 'Date',
        minWidth: 150,
        getCellContent: function getCellContent(row) {
          return row.get('date').toDateString();
        }
      });
      var openColumn = ConfigurableColumnDefinition['default'].create({
        headerCellName: 'Open',
        getCellContent: function getCellContent(row) {
          return row.get('open').toFixed(2);
        }
      });
      var highColumn = ConfigurableColumnDefinition['default'].create({
        headerCellName: 'High',
        getCellContent: function getCellContent(row) {
          return row.get('high').toFixed(2);
        }
      });
      var lowColumn = ConfigurableColumnDefinition['default'].create({
        headerCellName: 'Low',
        getCellContent: function getCellContent(row) {
          return row.get('low').toFixed(2);
        }
      });
      var closeColumn = ConfigurableColumnDefinition['default'].create({
        headerCellName: 'Close',
        getCellContent: function getCellContent(row) {
          return row.get('close').toFixed(2);
        }
      });
      return [dateColumn, openColumn, highColumn, lowColumn, closeColumn];
    }),

    content: Ember['default'].computed(function () {
      var content = [];
      var date;
      for (var i = 0; i < 100; i++) {
        date = new Date();
        date.setDate(date.getDate() + i);
        content.pushObject({
          date: date,
          open: Math.random() * 100 - 50,
          high: Math.random() * 100 - 50,
          low: Math.random() * 100 - 50,
          close: Math.random() * 100 - 50,
          volume: Math.random() * 1000000
        });
      }
      return content;
    }),

    actions: {
      // Pulls the table out of and back into the DOM
      refreshTable: function refreshTable() {
        var _this = this;
        this.set('showTable', false);
        Ember['default'].run.next(function () {
          _this.set('showTable', true);
        });
      }
    }
  });

});
define('dummy/controllers/dynamic-bars', ['exports', 'ember', 'ember-table/models/column-definition'], function (exports, Ember, ColumnDefinition) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({
    // TODO(azirbel): Don't use setInterval in an Ember application
    init: function init() {
      // TODO(azirbel): Call this._super()
      var _this = this;
      setInterval(function () {
        _this.get('tableContent').forEach(function (item) {
          item.set('value1', _this.getNextValue(item.get('value1')));
          item.set('value2', _this.getNextValue(item.get('value2')));
          item.set('value3', _this.getNextValue(item.get('value3')));
          item.set('value4', _this.getNextValue(item.get('value4')));
          item.set('value5', _this.getNextValue(item.get('value5')));
        });
      }, 1500);
    },

    getNextValue: function getNextValue(current) {
      current = current + (Math.random() * 10 - 5);
      current = Math.min(100, current);
      current = Math.max(0, current);
      return current;
    },

    tableColumns: Ember['default'].computed(function () {
      var colors = ['blue', 'teal', 'green', 'yellow', 'orange'];
      var firstColumn = ColumnDefinition['default'].create({
        savedWidth: 50,
        headerCellName: 'Name',
        contentPath: 'key'
      });
      var columns = colors.map(function (color, index) {
        return ColumnDefinition['default'].create({
          color: color,
          headerCellName: 'Bar',
          tableCellViewClass: 'bar-table-cell',
          contentPath: 'value' + (index + 1)
        });
      });
      columns.unshift(firstColumn);
      return columns;
    }),

    tableContent: Ember['default'].computed(function () {
      var content = [];
      for (var i = 0; i < 100; i++) {
        content.pushObject(Ember['default'].Object.create({
          key: i,
          value1: Math.random() * 80 + 10,
          value2: Math.random() * 80 + 10,
          value3: Math.random() * 80 + 10,
          value4: Math.random() * 80 + 10,
          value5: Math.random() * 80 + 10
        }));
      }
      return content;
    })
  });

});
define('dummy/controllers/editable', ['exports', 'ember', 'ember-table/models/column-definition'], function (exports, Ember, ColumnDefinition) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({
    tableColumns: Ember['default'].computed(function () {
      var columnNames = ['open', 'close'];
      var dateColumn = ColumnDefinition['default'].create({
        savedWidth: 100,
        headerCellName: 'Date',
        tableCellViewClass: 'date-picker-table-cell',
        getCellContent: function getCellContent(row) {
          return row.get('date').toString('yyyy-MM-dd');
        },
        setCellContent: function setCellContent(row, value) {
          return row.set('date', value);
        }
      });
      var ratingColumn = ColumnDefinition['default'].create({
        savedWidth: 150,
        headerCellName: 'Analyst Rating',
        tableCellViewClass: 'rating-table-cell',
        contentPath: 'rating',
        setCellContent: function setCellContent(row, value) {
          return row.set('rating', value);
        }
      });
      var columns = columnNames.map(function (key) {
        var name;
        name = key.charAt(0).toUpperCase() + key.slice(1);
        return ColumnDefinition['default'].create({
          savedWidth: 100,
          headerCellName: name,
          tableCellViewClass: 'editable-table-cell',
          getCellContent: function getCellContent(row) {
            return row.get(key).toFixed(2);
          },
          setCellContent: function setCellContent(row, value) {
            return row.set(key, +value);
          }
        });
      });
      columns.unshift(ratingColumn);
      columns.unshift(dateColumn);
      return columns;
    }),

    tableContent: Ember['default'].computed(function () {
      var content = [];
      var date;
      for (var i = 0; i < 100; i++) {
        date = new Date();
        date.setDate(date.getDate() + i);
        content.pushObject({
          index: i,
          date: date,
          open: Math.random() * 100 - 50,
          close: Math.random() * 100 - 50,
          rating: Math.round(Math.random() * 4)
        });
      }
      return content;
    })
  });

});
define('dummy/controllers/financial', ['exports', 'ember', 'dummy/models/treedata'], function (exports, Ember, Treedata) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({
    data: Ember['default'].computed(function () {
      return Treedata['default'];
    })
  });

});
define('dummy/controllers/horizon', ['exports', 'ember', 'ember-table/models/column-definition'], function (exports, Ember, ColumnDefinition) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({
    tableColumns: Ember['default'].computed(function () {
      var name = ColumnDefinition['default'].create({
        savedWidth: 100,
        headerCellName: 'Name',
        getCellContent: function getCellContent(row) {
          return 'Horizon ' + row.get('name');
        }
      });
      var horizon = ColumnDefinition['default'].create({
        savedWidth: 600,
        headerCellName: 'Horizon',
        tableCellViewClass: 'horizon-table-cell',
        getCellContent: Ember['default'].K
      });
      return [name, horizon];
    }),

    tableContent: Ember['default'].computed(function () {
      var normal = d3.random.normal(1.5, 3);
      var data;
      var content = [];
      for (var i = 0; i < 100; i++) {
        data = [];
        for (var j = 0; j < 100; j++) {
          data.push([j, normal()]);
        }
        content.pushObject({
          name: i,
          data: data
        });
      }
      return content;
    })
  });

});
define('dummy/controllers/object', ['exports', 'ember'], function (exports, Ember) {

	'use strict';

	exports['default'] = Ember['default'].Controller;

});
define('dummy/controllers/overview', ['exports', 'ember', 'dummy/models/treedata'], function (exports, Ember, Treedata) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({
    data: Ember['default'].computed(function () {
      return Treedata['default'];
    })
  });

});
define('dummy/controllers/simple', ['exports', 'ember', 'ember-table/models/column-definition'], function (exports, Ember, ColumnDefinition) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({
    tableColumns: Ember['default'].computed(function () {
      var dateColumn = ColumnDefinition['default'].create({
        savedWidth: 150,
        textAlign: 'text-align-left',
        headerCellName: 'Date',
        getCellContent: function getCellContent(row) {
          return row.get('date').toDateString();
        }
      });
      var openColumn = ColumnDefinition['default'].create({
        savedWidth: 100,
        headerCellName: 'Open',
        getCellContent: function getCellContent(row) {
          return row.get('open').toFixed(2);
        }
      });
      var highColumn = ColumnDefinition['default'].create({
        savedWidth: 100,
        headerCellName: 'High',
        getCellContent: function getCellContent(row) {
          return row.get('high').toFixed(2);
        }
      });
      var lowColumn = ColumnDefinition['default'].create({
        savedWidth: 100,
        headerCellName: 'Low',
        getCellContent: function getCellContent(row) {
          return row.get('low').toFixed(2);
        }
      });
      var closeColumn = ColumnDefinition['default'].create({
        savedWidth: 100,
        headerCellName: 'Close',
        getCellContent: function getCellContent(row) {
          return row.get('close').toFixed(2);
        }
      });
      return [dateColumn, openColumn, highColumn, lowColumn, closeColumn];
    }),

    tableContent: Ember['default'].computed(function () {
      var content = [];
      var date;
      for (var i = 0; i < 100; i++) {
        date = new Date();
        date.setDate(date.getDate() + i);
        content.pushObject({
          date: date,
          open: Math.random() * 100 - 50,
          high: Math.random() * 100 - 50,
          low: Math.random() * 100 - 50,
          close: Math.random() * 100 - 50,
          volume: Math.random() * 1000000
        });
      }
      return content;
    })
  });

});
define('dummy/controllers/sparkline', ['exports', 'ember', 'ember-table/models/column-definition'], function (exports, Ember, ColumnDefinition) {

  'use strict';

  exports['default'] = Ember['default'].Controller.extend({
    tableColumns: Ember['default'].computed(function () {
      var name = ColumnDefinition['default'].create({
        savedWidth: 100,
        headerCellName: 'Name',
        getCellContent: function getCellContent(row) {
          return 'Asset ' + row.get('name');
        }
      });
      var open = ColumnDefinition['default'].create({
        savedWidth: 100,
        headerCellName: 'Open',
        getCellContent: function getCellContent(row) {
          return row.get('open').toFixed(2);
        }
      });
      var spark = ColumnDefinition['default'].create({
        savedWidth: 200,
        headerCellName: 'Sparkline',
        tableCellViewClass: 'sparkline-table-cell',
        contentPath: 'timeseries'
      });
      var close = ColumnDefinition['default'].create({
        savedWidth: 100,
        headerCellName: 'Close',
        getCellContent: function getCellContent(row) {
          return row.get('close').toFixed(2);
        }
      });
      var low = ColumnDefinition['default'].create({
        savedWidth: 100,
        headerCellName: 'Low',
        getCellContent: function getCellContent(row) {
          return row.get('low').toFixed(2);
        }
      });
      var high = ColumnDefinition['default'].create({
        savedWidth: 100,
        headerCellName: 'High',
        getCellContent: function getCellContent(row) {
          return row.get('high').toFixed(2);
        }
      });
      return [name, open, spark, close, low, high];
    }),

    tableContent: Ember['default'].computed(function () {
      var randomWalk = function randomWalk(numSteps) {
        var lastValue = 0;
        var walk = [];
        for (var i = 0; i < numSteps; i++) {
          lastValue = lastValue + d3.random.normal()();
          walk.push(lastValue);
        }
        return walk;
      };
      var content = [];
      var data;
      for (var i = 0; i < 100; i++) {
        data = randomWalk(100);
        content.pushObject({
          name: i,
          timeseries: data,
          open: data[0],
          close: data[99],
          low: Math.min.apply(null, data),
          high: Math.max.apply(null, data)
        });
      }
      return content;
    })
  });

});
define('dummy/ember-table/tests/modules/ember-table/components/ember-table.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/components');
  test('modules/ember-table/components/ember-table.js should pass jshint', function () {
    ok(true, 'modules/ember-table/components/ember-table.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/controllers/row-array.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/controllers');
  test('modules/ember-table/controllers/row-array.js should pass jshint', function () {
    ok(true, 'modules/ember-table/controllers/row-array.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/controllers/row.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/controllers');
  test('modules/ember-table/controllers/row.js should pass jshint', function () {
    ok(true, 'modules/ember-table/controllers/row.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/mixins/mouse-wheel-handler.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/mixins');
  test('modules/ember-table/mixins/mouse-wheel-handler.js should pass jshint', function () {
    ok(true, 'modules/ember-table/mixins/mouse-wheel-handler.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/mixins/register-table-component.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/mixins');
  test('modules/ember-table/mixins/register-table-component.js should pass jshint', function () {
    ok(true, 'modules/ember-table/mixins/register-table-component.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/mixins/resize-handler.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/mixins');
  test('modules/ember-table/mixins/resize-handler.js should pass jshint', function () {
    ok(true, 'modules/ember-table/mixins/resize-handler.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/mixins/scroll-handler.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/mixins');
  test('modules/ember-table/mixins/scroll-handler.js should pass jshint', function () {
    ok(true, 'modules/ember-table/mixins/scroll-handler.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/mixins/show-horizontal-scroll.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/mixins');
  test('modules/ember-table/mixins/show-horizontal-scroll.js should pass jshint', function () {
    ok(true, 'modules/ember-table/mixins/show-horizontal-scroll.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/mixins/style-bindings.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/mixins');
  test('modules/ember-table/mixins/style-bindings.js should pass jshint', function () {
    ok(true, 'modules/ember-table/mixins/style-bindings.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/mixins/touch-move-handler.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/mixins');
  test('modules/ember-table/mixins/touch-move-handler.js should pass jshint', function () {
    ok(true, 'modules/ember-table/mixins/touch-move-handler.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/models/column-definition.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/models');
  test('modules/ember-table/models/column-definition.js should pass jshint', function () {
    ok(true, 'modules/ember-table/models/column-definition.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/views/body-table-container.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/views');
  test('modules/ember-table/views/body-table-container.js should pass jshint', function () {
    ok(true, 'modules/ember-table/views/body-table-container.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/views/column-sortable-indicator.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/views');
  test('modules/ember-table/views/column-sortable-indicator.js should pass jshint', function () {
    ok(true, 'modules/ember-table/views/column-sortable-indicator.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/views/footer-table-container.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/views');
  test('modules/ember-table/views/footer-table-container.js should pass jshint', function () {
    ok(true, 'modules/ember-table/views/footer-table-container.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/views/header-block.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/views');
  test('modules/ember-table/views/header-block.js should pass jshint', function () {
    ok(true, 'modules/ember-table/views/header-block.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/views/header-cell.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/views');
  test('modules/ember-table/views/header-cell.js should pass jshint', function () {
    ok(true, 'modules/ember-table/views/header-cell.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/views/header-row.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/views');
  test('modules/ember-table/views/header-row.js should pass jshint', function () {
    ok(true, 'modules/ember-table/views/header-row.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/views/header-table-container.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/views');
  test('modules/ember-table/views/header-table-container.js should pass jshint', function () {
    ok(true, 'modules/ember-table/views/header-table-container.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/views/lazy-container.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/views');
  test('modules/ember-table/views/lazy-container.js should pass jshint', function () {
    ok(true, 'modules/ember-table/views/lazy-container.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/views/lazy-item.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/views');
  test('modules/ember-table/views/lazy-item.js should pass jshint', function () {
    ok(true, 'modules/ember-table/views/lazy-item.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/views/lazy-table-block.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/views');
  test('modules/ember-table/views/lazy-table-block.js should pass jshint', function () {
    ok(true, 'modules/ember-table/views/lazy-table-block.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/views/multi-item-collection.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/views');
  test('modules/ember-table/views/multi-item-collection.js should pass jshint', function () {
    ok(true, 'modules/ember-table/views/multi-item-collection.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/views/scroll-container.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/views');
  test('modules/ember-table/views/scroll-container.js should pass jshint', function () {
    ok(true, 'modules/ember-table/views/scroll-container.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/views/scroll-panel.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/views');
  test('modules/ember-table/views/scroll-panel.js should pass jshint', function () {
    ok(true, 'modules/ember-table/views/scroll-panel.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/views/table-block.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/views');
  test('modules/ember-table/views/table-block.js should pass jshint', function () {
    ok(true, 'modules/ember-table/views/table-block.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/views/table-cell.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/views');
  test('modules/ember-table/views/table-cell.js should pass jshint', function () {
    ok(true, 'modules/ember-table/views/table-cell.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/views/table-container.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/views');
  test('modules/ember-table/views/table-container.js should pass jshint', function () {
    ok(true, 'modules/ember-table/views/table-container.js should pass jshint.');
  });

});
define('dummy/ember-table/tests/modules/ember-table/views/table-row.jshint', function () {

  'use strict';

  module('JSHint - modules/ember-table/views');
  test('modules/ember-table/views/table-row.js should pass jshint', function () {
    ok(true, 'modules/ember-table/views/table-row.js should pass jshint.');
  });

});
define('dummy/helpers/fa-icon', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  var FA_PREFIX = /^fa\-.+/;

  var warn = Ember['default'].Logger.warn;

  /**
   * Handlebars helper for generating HTML that renders a FontAwesome icon.
   *
   * @param  {String} name    The icon name. Note that the `fa-` prefix is optional.
   *                          For example, you can pass in either `fa-camera` or just `camera`.
   * @param  {Object} options Options passed to helper.
   * @return {Ember.Handlebars.SafeString} The HTML markup.
   */
  var faIcon = function faIcon(name, options) {
    if (Ember['default'].typeOf(name) !== 'string') {
      var message = 'fa-icon: no icon specified';
      warn(message);
      return Ember['default'].String.htmlSafe(message);
    }

    var params = options.hash,
        classNames = [],
        html = '';

    classNames.push('fa');
    if (!name.match(FA_PREFIX)) {
      name = 'fa-' + name;
    }
    classNames.push(name);
    if (params.spin) {
      classNames.push('fa-spin');
    }
    if (params.flip) {
      classNames.push('fa-flip-' + params.flip);
    }
    if (params.rotate) {
      classNames.push('fa-rotate-' + params.rotate);
    }
    if (params.lg) {
      warn('fa-icon: the \'lg\' parameter is deprecated. Use \'size\' instead. I.e. {{fa-icon size="lg"}}');
      classNames.push('fa-lg');
    }
    if (params.x) {
      warn('fa-icon: the \'x\' parameter is deprecated. Use \'size\' instead. I.e. {{fa-icon size="' + params.x + '"}}');
      classNames.push('fa-' + params.x + 'x');
    }
    if (params.size) {
      if (Ember['default'].typeOf(params.size) === 'string' && params.size.match(/\d+/)) {
        params.size = Number(params.size);
      }
      if (Ember['default'].typeOf(params.size) === 'number') {
        classNames.push('fa-' + params.size + 'x');
      } else {
        classNames.push('fa-' + params.size);
      }
    }
    if (params.fixedWidth) {
      classNames.push('fa-fw');
    }
    if (params.listItem) {
      classNames.push('fa-li');
    }
    if (params.pull) {
      classNames.push('pull-' + params.pull);
    }
    if (params.border) {
      classNames.push('fa-border');
    }
    if (params.classNames && !Ember['default'].isArray(params.classNames)) {
      params.classNames = [params.classNames];
    }
    if (!Ember['default'].isEmpty(params.classNames)) {
      Array.prototype.push.apply(classNames, params.classNames);
    }

    html += '<';
    var tagName = params.tagName || 'i';
    html += tagName;
    html += ' class=\'' + classNames.join(' ') + '\'';
    if (params.title) {
      html += ' title=\'' + params.title + '\'';
    }
    if (params.ariaHidden === undefined || params.ariaHidden) {
      html += ' aria-hidden="true"';
    }
    html += '></' + tagName + '>';
    return Ember['default'].String.htmlSafe(html);
  };

  exports['default'] = Ember['default'].Handlebars.makeBoundHelper(faIcon);

  exports.faIcon = faIcon;

});
define('dummy/initializers/export-application-global', ['exports', 'ember', 'dummy/config/environment'], function (exports, Ember, config) {

  'use strict';

  exports.initialize = initialize;

  function initialize(container, application) {
    var classifiedName = Ember['default'].String.classify(config['default'].modulePrefix);

    if (config['default'].exportApplicationGlobal && !window[classifiedName]) {
      window[classifiedName] = application;
    }
  }

  ;

  exports['default'] = {
    name: 'export-application-global',

    initialize: initialize
  };

});
define('dummy/instance-initializers/app-version', ['exports', 'dummy/config/environment', 'ember'], function (exports, config, Ember) {

  'use strict';

  var classify = Ember['default'].String.classify;
  var registered = false;

  exports['default'] = {
    name: 'App Version',
    initialize: function initialize(application) {
      if (!registered) {
        var appName = classify(application.toString());
        Ember['default'].libraries.register(appName, config['default'].APP.version);
        registered = true;
      }
    }
  };

});
define('dummy/models/treedata', ['exports'], function (exports) {

	'use strict';

	exports['default'] = {'root':{'group_value':'Total','level':0,'values':[{'type':'money','value':60269996.24879856,'currency':'USD'},{'type':'money','value':61494836.611845456,'currency':'USD'},{'type':'money','value':60816540.19589533,'currency':'USD'},{'type':'money','value':-1039739.6313347403,'currency':'USD'},{'type':'percent','value':-0.016858920950260137},{'type':'percent','value':-0.01685892095026014}],'children':[{'group_name':'Owner (Down)','group_value':'Uncle Money Penny','level':1,'values':[{'type':'money','value':60269996.248798564,'currency':'USD'},{'type':'money','value':61494836.61184546,'currency':'USD'},{'type':'money','value':60816540.19589534,'currency':'USD'},{'type':'money','value':-1039739.6313347424,'currency':'USD'},{'type':'percent','value':-0.016858920950260176},{'type':'percent','value':-0.01685892095026018}],'children':[{'group_name':'Owner (Down)','group_value':'The Money Penny Trust','level':2,'values':[{'type':'money','value':18241432.089211173,'currency':'USD'},{'type':'money','value':19049191.44150407,'currency':'USD'},{'type':'money','value':18480088.281079322,'currency':'USD'},{'type':'money','value':-549006.9566043427,'currency':'USD'},{'type':'percent','value':-0.028841927979075494},{'type':'percent','value':-0.00890190640386938}],'children':[{'group_name':'Owner (Down)','group_value':'Sterling Holdings, LLC','level':3,'values':[{'type':'money','value':6828594.139080001,'currency':'USD'},{'type':'money','value':6840053.28,'currency':'USD'},{'type':'money','value':6841431,'currency':'USD'},{'type':'money','value':8502.119999999879,'currency':'USD'},{'type':'percent','value':0.0012440650800411423},{'type':'percent','value':0.00013785813743159806}],'children':[{'group_name':'Holding Status','group_value':'Current Holding','level':4,'values':[{'type':'money','value':6828594.139080001,'currency':'USD'},{'type':'money','value':6840053.28,'currency':'USD'},{'type':'money','value':6841431,'currency':'USD'},{'type':'money','value':8502.119999999879,'currency':'USD'},{'type':'percent','value':0.0012440650800411423},{'type':'percent','value':0.00013785813743159806}],'children':[{'group_name':'Asset Class','group_value':'Fixed Income','level':5,'values':[{'type':'money','value':6828594.139080001,'currency':'USD'},{'type':'money','value':6840053.28,'currency':'USD'},{'type':'money','value':6841431,'currency':'USD'},{'type':'money','value':8502.119999999879,'currency':'USD'},{'type':'percent','value':0.0012440650800411423},{'type':'percent','value':0.00013785813743159806}],'children':[{'group_name':'Security','group_value':'Bay Area Toll Auth Calif Toll Rev BDS 3.50 % Due Apr 1, 2019','level':6,'values':[{'type':'money','value':38471.4,'currency':'USD'},{'type':'money','value':38232.00000000001,'currency':'USD'},{'type':'money','value':38656.8,'currency':'USD'},{'type':'money','value':424.79999999999563,'currency':'USD'},{'type':'percent','value':0.011111111111110995},{'type':'percent','value':0.000006887945216127635}]},{'group_name':'Security','group_value':'Bay Area Toll Auth Calif Toll Toll Bridge Rev 3.90 % Due Apr 1, 2014','level':6,'values':[{'type':'money','value':38471.4,'currency':'USD'},{'type':'money','value':38232.00000000001,'currency':'USD'},{'type':'money','value':38656.8,'currency':'USD'},{'type':'money','value':424.79999999999563,'currency':'USD'},{'type':'percent','value':0.011111111111110995},{'type':'percent','value':0.000006887945216127635}]},{'group_name':'Security','group_value':'Berkshire Hathaway Inc 3.20 % Due Feb 11, 2015','level':6,'values':[{'type':'money','value':38063.16,'currency':'USD'},{'type':'money','value':38147.04,'currency':'USD'},{'type':'money','value':37989.36000000001,'currency':'USD'},{'type':'money','value':-157.67999999999302,'currency':'USD'},{'type':'percent','value':-0.0041334792948546735},{'type':'percent','value':-0.0000025567118683591537}]},{'group_name':'Security','group_value':'Burlington Northern Santa Fe CP 4.30 % Due Jul 1, 2013','level':6,'values':[{'type':'money','value':37758.600000000006,'currency':'USD'},{'type':'money','value':38019.96000000001,'currency':'USD'},{'type':'money','value':37260.00000000001,'currency':'USD'},{'type':'money','value':-759.9599999999991,'currency':'USD'},{'type':'percent','value':-0.019988448173012256},{'type':'percent','value':-0.000012322417246818278}]},{'group_name':'Security','group_value':'Burlington Northern Santa Fe CP 4.70 % Due Oct 1, 2019','level':6,'values':[{'type':'money','value':39441.600000000006,'currency':'USD'},{'type':'money','value':40383.00000000001,'currency':'USD'},{'type':'money','value':40011.840000000004,'currency':'USD'},{'type':'money','value':-371.1600000000035,'currency':'USD'},{'type':'percent','value':-0.009190996211277107},{'type':'percent','value':-0.000006018196201548924}]},{'group_name':'Security','group_value':'CA CNTY Calif Tob Sec Asset Backed BDS 5.00 % Due Jun 1, 2036','level':6,'values':[{'type':'money','value':1423656.0000000002,'currency':'USD'},{'type':'money','value':1467460.8000000003,'currency':'USD'},{'type':'money','value':1468519.2,'currency':'USD'},{'type':'money','value':1058.399999999674,'currency':'USD'},{'type':'percent','value':0.0007212458417967103},{'type':'percent','value':0.000017161490623228148}]},{'group_name':'Security','group_value':'Canadian Natl RY Co 7.62 % Due May 15, 2023','level':6,'values':[{'type':'money','value':48960.00000000001,'currency':'USD'},{'type':'money','value':50580.00000000001,'currency':'USD'},{'type':'money','value':49207.50000000001,'currency':'USD'},{'type':'money','value':0,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':0}]},{'group_name':'Security','group_value':'Comcast Corp 6.50 % Due Jan 15, 2015','level':6,'values':[{'type':'money','value':40730.4,'currency':'USD'},{'type':'money','value':41179.32000000001,'currency':'USD'},{'type':'money','value':40817.520000000004,'currency':'USD'},{'type':'money','value':-361.8000000000029,'currency':'USD'},{'type':'percent','value':-0.008785963439901456},{'type':'percent','value':-0.000005866427917125762}]},{'group_name':'Security','group_value':'CSX Corp 5.75 % Due Mar 15, 2013','level':6,'values':[{'type':'money','value':38115.36000000001,'currency':'USD'},{'type':'money','value':38282.4,'currency':'USD'},{'type':'money','value':38055.96000000001,'currency':'USD'},{'type':'money','value':-226.43999999999505,'currency':'USD'},{'type':'percent','value':-0.005914989655820822},{'type':'percent','value':-0.0000036716250346985016}]},{'group_name':'Security','group_value':'Dell Inc 1.40 % Due Sep 10, 2013','level':6,'values':[{'type':'money','value':36448.560000000005,'currency':'USD'},{'type':'money','value':36234.00000000001,'currency':'USD'},{'type':'money','value':36241.560000000005,'currency':'USD'},{'type':'money','value':7.559999999997672,'currency':'USD'},{'type':'percent','value':0.00020864381520112796},{'type':'percent','value':1.2258207588020108e-7}]},{'group_name':'Security','group_value':'Du Pont E I De Nemours & Co 3.25 % Due Jan 15, 2015','level':6,'values':[{'type':'money','value':38441.16,'currency':'USD'},{'type':'money','value':38532.600000000006,'currency':'USD'},{'type':'money','value':38362.68000000001,'currency':'USD'},{'type':'money','value':-169.91999999999825,'currency':'USD'},{'type':'percent','value':-0.004409772504320971},{'type':'percent','value':-0.0000027551780864510538}]},{'group_name':'Security','group_value':'Duke Energy 3.95 % Due Sep 15, 2014','level':6,'values':[{'type':'money','value':38405.520000000004,'currency':'USD'},{'type':'money','value':38570.04000000001,'currency':'USD'},{'type':'money','value':38552.04000000001,'currency':'USD'},{'type':'money','value':-18,'currency':'USD'},{'type':'percent','value':-0.00046668346727148834},{'type':'percent','value':-2.9186208542914004e-7}]},{'group_name':'Security','group_value':'Golden ST Tob Sec C Tobacco Settlement 5.12 % Due May 31, 2047','level':6,'values':[{'type':'money','value':1350000.0000000002,'currency':'USD'},{'type':'money','value':1333087.2000000002,'currency':'USD'},{'type':'money','value':1326240.0000000002,'currency':'USD'},{'type':'money','value':-6847.199999999953,'currency':'USD'},{'type':'percent','value':-0.005136348169872123},{'type':'percent','value':-0.00011102433729724412}]},{'group_name':'Security','group_value':'Golden ST Tob Sec C Tobacco Settlement 5.75 % Due Jun 1, 2047','level':6,'values':[{'type':'money','value':1260000.0000000002,'currency':'USD'},{'type':'money','value':1243800,'currency':'USD'},{'type':'money','value':1256778.0000000002,'currency':'USD'},{'type':'money','value':12978.000000000233,'currency':'USD'},{'type':'percent','value':0.010434153400868494},{'type':'percent','value':0.00021043256359441374}]},{'group_name':'Security','group_value':'Long Beach Calif HBR Rev Rev BDS 4.00 % Due May 15, 2019','level':6,'values':[{'type':'money','value':40452.840000000004,'currency':'USD'},{'type':'money','value':38716.560000000005,'currency':'USD'},{'type':'money','value':40452.840000000004,'currency':'USD'},{'type':'money','value':2456.279999999999,'currency':'USD'},{'type':'percent','value':0.06402791155277268},{'type':'percent','value':0.00003982750017766043}]},{'group_name':'Security','group_value':'Menlo PK Calif City SCH Dist Go BDS 0.00 % Due Jul 1, 2040','level':6,'values':[{'type':'money','value':1752192.0000000002,'currency':'USD'},{'type':'money','value':1752192.0000000002,'currency':'USD'},{'type':'money','value':1752192.0000000002,'currency':'USD'},{'type':'money','value':0,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':0}]},{'group_name':'Security','group_value':'Midamerican Energy Co 5.30 % Due Mar 15, 2018','level':6,'values':[{'type':'money','value':41422.339080000005,'currency':'USD'},{'type':'money','value':41973.840000000004,'currency':'USD'},{'type':'money','value':41568.12,'currency':'USD'},{'type':'money','value':-405.72000000000116,'currency':'USD'},{'type':'percent','value':-0.009666020549942563},{'type':'percent','value':-0.000006578571405572836}]},{'group_name':'Security','group_value':'Napa Calif Santn Dist CTFS Par Cops 5.00 % Due Aug 1, 2013','level':6,'values':[{'type':'money','value':38045.16,'currency':'USD'},{'type':'money','value':38592.72,'currency':'USD'},{'type':'money','value':38131.560000000005,'currency':'USD'},{'type':'money','value':-461.1599999999962,'currency':'USD'},{'type':'percent','value':-0.011949403929031077},{'type':'percent','value':-0.000007477506628694506}]},{'group_name':'Security','group_value':'National Grid PLC 6.30 % Due Aug 1, 2016','level':6,'values':[{'type':'money','value':41097.600000000006,'currency':'USD'},{'type':'money','value':41767.920000000006,'currency':'USD'},{'type':'money','value':41082.48,'currency':'USD'},{'type':'money','value':-685.4400000000023,'currency':'USD'},{'type':'percent','value':-0.01641068073296449},{'type':'percent','value':-0.000011114108213141692}]},{'group_name':'Security','group_value':'Norfolk Southern Corp 7.05 % Due May 1, 2037','level':6,'values':[{'type':'money','value':46945.44,'currency':'USD'},{'type':'money','value':46945.44,'currency':'USD'},{'type':'money','value':45684.54000000001,'currency':'USD'},{'type':'money','value':7.275957614183426e-12,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':0}]},{'group_name':'Security','group_value':'Pacific Gas & Elec Co 3.25 % Due Sep 15, 2021','level':6,'values':[{'type':'money','value':36443.520000000004,'currency':'USD'},{'type':'money','value':36476.280000000006,'currency':'USD'},{'type':'money','value':36115.920000000006,'currency':'USD'},{'type':'money','value':-360.3600000000006,'currency':'USD'},{'type':'percent','value':-0.00987929690198673},{'type':'percent','value':-0.000005843078950291393}]},{'group_name':'Security','group_value':'Pepsico Inc 3.75 % Due Mar 1, 2014','level':6,'values':[{'type':'money','value':38118.96000000001,'currency':'USD'},{'type':'money','value':38498.4,'currency':'USD'},{'type':'money','value':38247.12,'currency':'USD'},{'type':'money','value':-251.27999999999884,'currency':'USD'},{'type':'percent','value':-0.006527024499719439},{'type':'percent','value':-0.0000040743947125907765}]},{'group_name':'Security','group_value':'Port Oakland CA Rev Inter Lien Rev Ref BDS 5.00 % Due Nov 1, 2017','level':6,'values':[{'type':'money','value':41180.04000000001,'currency':'USD'},{'type':'money','value':39441.600000000006,'currency':'USD'},{'type':'money','value':39902.76,'currency':'USD'},{'type':'money','value':1361.1599999999962,'currency':'USD'},{'type':'percent','value':0.035288714560572254},{'type':'percent','value':0.000022070610900151507}]},{'group_name':'Security','group_value':'Reynolds R J Tob HLDGS Inc 9.25 % Due Aug 15, 2013','level':6,'values':[{'type':'money','value':39547.8,'currency':'USD'},{'type':'money','value':41373.72000000001,'currency':'USD'},{'type':'money','value':39009.600000000006,'currency':'USD'},{'type':'money','value':-2364.1200000000026,'currency':'USD'},{'type':'percent','value':-0.05714061969772121},{'type':'percent','value':-0.000038333166300263294}]},{'group_name':'Security','group_value':'Sac Calif City Fing Aut Ref Rev BDS 5.00 % Due Dec 1, 2014','level':6,'values':[{'type':'money','value':39448.8,'currency':'USD'},{'type':'money','value':39307.32000000001,'currency':'USD'},{'type':'money','value':39448.8,'currency':'USD'},{'type':'money','value':141.47999999999593,'currency':'USD'},{'type':'percent','value':0.0035993295905189134},{'type':'percent','value':0.000002294035991472975}]},{'group_name':'Security','group_value':'SD CNTY Calif WTR Auth Water Rev BDS 4.00 % Due May 1, 2014','level':6,'values':[{'type':'money','value':38529.36000000001,'currency':'USD'},{'type':'money','value':38528.280000000006,'currency':'USD'},{'type':'money','value':38529.36000000001,'currency':'USD'},{'type':'money','value':721.0800000000017,'currency':'USD'},{'type':'percent','value':0.01905993068485019},{'type':'percent','value':0.000011691995142291378}]},{'group_name':'Security','group_value':'SF Calif City & CNT Lease Rev BDS 5.00 % Due Jun 15, 2022','level':6,'values':[{'type':'money','value':40270.32000000001,'currency':'USD'},{'type':'money','value':39305.520000000004,'currency':'USD'},{'type':'money','value':40270.32000000001,'currency':'USD'},{'type':'money','value':964.8000000000029,'currency':'USD'},{'type':'percent','value':0.024546170614203878},{'type':'percent','value':0.000015643807779001955}]},{'group_name':'Security','group_value':'SF Calif City & CNT Second Series 5.73 % Due Jun 11, 2031','level':6,'values':[{'type':'money','value':39948.48,'currency':'USD'},{'type':'money','value':39053.880000000005,'currency':'USD'},{'type':'money','value':39825.00000000001,'currency':'USD'},{'type':'money','value':771.1200000000026,'currency':'USD'},{'type':'percent','value':0.01974502917507819},{'type':'percent','value':0.000012503371739784402}]},{'group_name':'Security','group_value':'SF Calif City & CNT WTR Rev BDS 5.00 % Due Nov 1, 2015','level':6,'values':[{'type':'money','value':41299.920000000006,'currency':'USD'},{'type':'money','value':41536.44,'currency':'USD'},{'type':'money','value':41269.32000000001,'currency':'USD'},{'type':'money','value':632.8800000000047,'currency':'USD'},{'type':'percent','value':0.0155627256171805},{'type':'percent','value':0.00001026187092368864}]},{'group_name':'Security','group_value':'SF Calif City & CNT WTR Rev BDS 6.95 % Due Nov 1, 2050','level':6,'values':[{'type':'money','value':46688.40000000001,'currency':'USD'},{'type':'money','value':45603.00000000001,'currency':'USD'},{'type':'money','value':44352.00000000001,'currency':'USD'},{'type':'money','value':0,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':0}]}]}]}]},{'group_name':'Owner (Down)','group_value':'Directly Owned','level':3,'values':[{'type':'money','value':11412837.950131172,'currency':'USD'},{'type':'money','value':12209138.16150407,'currency':'USD'},{'type':'money','value':11638657.281079324,'currency':'USD'},{'type':'money','value':-557509.0766043423,'currency':'USD'},{'type':'percent','value':-0.04569464814997896},{'type':'percent','value':-0.009039764541300975}],'children':[{'group_name':'Holding Status','group_value':'Current Holding','level':4,'values':[{'type':'money','value':11412837.950131172,'currency':'USD'},{'type':'money','value':12209138.16150407,'currency':'USD'},{'type':'money','value':11638657.281079324,'currency':'USD'},{'type':'money','value':-557509.0766043423,'currency':'USD'},{'type':'percent','value':-0.04569464814997896},{'type':'percent','value':-0.009039764541300975}],'children':[{'group_name':'Asset Class','group_value':'Equity','level':5,'values':[{'type':'money','value':10752798.650131172,'currency':'USD'},{'type':'money','value':11545886.761504069,'currency':'USD'},{'type':'money','value':10982219.781079324,'currency':'USD'},{'type':'money','value':-550695.1766043424,'currency':'USD'},{'type':'percent','value':-0.04773083747756965},{'type':'percent','value':-0.008929280148861775}],'children':[{'group_name':'Security','group_value':'Aflac, Inc','level':6,'values':[{'type':'money','value':773996.2160337,'currency':'USD'},{'type':'money','value':853079.6719863001,'currency':'USD'},{'type':'money','value':821862.5183208,'currency':'USD'},{'type':'money','value':-24973.72293150006,'currency':'USD'},{'type':'percent','value':-0.02939034020252622},{'type':'percent','value':-0.00040493793642873026}]},{'group_name':'Security','group_value':'Amazon.Com, Inc','level':6,'values':[{'type':'money','value':1218327.10971093,'currency':'USD'},{'type':'money','value':1435093.353163305,'currency':'USD'},{'type':'money','value':1292464.525688595,'currency':'USD'},{'type':'money','value':-142628.82747471007,'currency':'USD'},{'type':'percent','value':-0.09938644559973776},{'type':'percent','value':-0.0023126637238378837}]},{'group_name':'Security','group_value':'Apple, Inc.','level':6,'values':[{'type':'money','value':1602345.684855546,'currency':'USD'},{'type':'money','value':1702266.249319794,'currency':'USD'},{'type':'money','value':1607308.06979106,'currency':'USD'},{'type':'money','value':-94958.17952873395,'currency':'USD'},{'type':'percent','value':-0.05578338850733729},{'type':'percent','value':-0.0015397051281006093}]},{'group_name':'Security','group_value':'Baidu, Inc','level':6,'values':[{'type':'money','value':251366.97313778396,'currency':'USD'},{'type':'money','value':307689.681229956,'currency':'USD'},{'type':'money','value':287517.98647675803,'currency':'USD'},{'type':'money','value':-20171.694753197953,'currency':'USD'},{'type':'percent','value':-0.06555856755599929},{'type':'percent','value':-0.0003270751609615776}]},{'group_name':'Security','group_value':'Berkshire Hathaway Inc','level':6,'values':[{'type':'money','value':1014984.9394992001,'currency':'USD'},{'type':'money','value':1056777.1081632,'currency':'USD'},{'type':'money','value':1070783.132256,'currency':'USD'},{'type':'money','value':14006.024092799984,'currency':'USD'},{'type':'percent','value':0.013253527148353981},{'type':'percent','value':0.00022710152223863236}]},{'group_name':'Security','group_value':'Boeing Co.','level':6,'values':[{'type':'money','value':1137575.6496792,'currency':'USD'},{'type':'money','value':1053951.5841768002,'currency':'USD'},{'type':'money','value':1100409.3983448,'currency':'USD'},{'type':'money','value':53186.187254399876,'currency':'USD'},{'type':'percent','value':0.0506990429849482},{'type':'percent','value':0.0008623906404496608}]},{'group_name':'Security','group_value':'Chipotle Mexican Grill, Inc','level':6,'values':[{'type':'money','value':3262295.080584,'currency':'USD'},{'type':'money','value':3443852.4575562007,'currency':'USD'},{'type':'money','value':3294672.1297506006,'currency':'USD'},{'type':'money','value':-149180.32780560013,'currency':'USD'},{'type':'percent','value':-0.04331786266809476},{'type':'percent','value':-0.0024188934210191766}]},{'group_name':'Security','group_value':'General Electric Company','level':6,'values':[{'type':'money','value':990873.7863488102,'currency':'USD'},{'type':'money','value':973398.0581945102,'currency':'USD'},{'type':'money','value':926796.1164497101,'currency':'USD'},{'type':'money','value':-46601.941744800075,'currency':'USD'},{'type':'percent','value':-0.04787552363853986},{'type':'percent','value':-0.0007556299945935915}]},{'group_name':'Security','group_value':'Green Mountain Coffee Roasters','level':6,'values':[{'type':'money','value':501033.210282,'currency':'USD'},{'type':'money','value':719778.5977139999,'currency':'USD'},{'type':'money','value':580405.904001,'currency':'USD'},{'type':'money','value':-139372.69371299993,'currency':'USD'},{'type':'percent','value':-0.19363272839126414},{'type':'percent','value':-0.0022598669466084974}]}]},{'group_name':'Asset Class','group_value':'Fixed Income','level':5,'values':[{'type':'money','value':660039.3,'currency':'USD'},{'type':'money','value':663251.4,'currency':'USD'},{'type':'money','value':656437.5000000001,'currency':'USD'},{'type':'money','value':-6813.900000000023,'currency':'USD'},{'type':'percent','value':-0.01027348001074709},{'type':'percent','value':-0.00011048439243920134}],'children':[{'group_name':'Security','group_value':'American Express Co 4.88 % Due Jul 15, 2013','level':6,'values':[{'type':'money','value':94106.7,'currency':'USD'},{'type':'money','value':94784.40000000001,'currency':'USD'},{'type':'money','value':94344.3,'currency':'USD'},{'type':'money','value':-440.1000000000058,'currency':'USD'},{'type':'percent','value':-0.0046431691290972545},{'type':'percent','value':-0.000007136027988742569}]},{'group_name':'Security','group_value':'East Bay Calif Mun Util Dist W Rev BDS 4.00 % Due Jun 1, 2014','level':6,'values':[{'type':'money','value':96615,'currency':'USD'},{'type':'money','value':95378.40000000001,'currency':'USD'},{'type':'money','value':95378.40000000001,'currency':'USD'},{'type':'money','value':0,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':0}]},{'group_name':'Security','group_value':'FPL Group Cap Inc 5.35 % Due Jun 15, 2013','level':6,'values':[{'type':'money','value':95578.2,'currency':'USD'},{'type':'money','value':95585.40000000001,'currency':'USD'},{'type':'money','value':95625,'currency':'USD'},{'type':'money','value':39.59999999999127,'currency':'USD'},{'type':'percent','value':0.00041428921153221376},{'type':'percent','value':6.420965879439665e-7}]},{'group_name':'Security','group_value':'JPMorgan Chase & Co Unsec. Notes 4.75 % Due Jul 15, 2013','level':6,'values':[{'type':'money','value':90823.5,'currency':'USD'},{'type':'money','value':92850.3,'currency':'USD'},{'type':'money','value':91250.1,'currency':'USD'},{'type':'money','value':-1600.199999999997,'currency':'USD'},{'type':'percent','value':-0.01723419310438412},{'type':'percent','value':-0.000025946539394650502}]},{'group_name':'Security','group_value':'Metlife Inc 5.38 % Due Dec 15, 2012','level':6,'values':[{'type':'money','value':93712.5,'currency':'USD'},{'type':'money','value':93150,'currency':'USD'},{'type':'money','value':93757.5,'currency':'USD'},{'type':'money','value':607.5,'currency':'USD'},{'type':'percent','value':0.006521739130434782},{'type':'percent','value':0.000009850345383233477}]},{'group_name':'Security','group_value':'Morgan Stanley 2.88 % Due Jul 28, 2014','level':6,'values':[{'type':'money','value':85325.40000000001,'currency':'USD'},{'type':'money','value':88021.8,'currency':'USD'},{'type':'money','value':84289.5,'currency':'USD'},{'type':'money','value':-3732.300000000003,'currency':'USD'},{'type':'percent','value':-0.04240199586920516},{'type':'percent','value':-0.00006051760341373224}]},{'group_name':'Security','group_value':'Ohio PWR Co 5.38 % Due Oct 1, 2021','level':6,'values':[{'type':'money','value':103878,'currency':'USD'},{'type':'money','value':103481.1,'currency':'USD'},{'type':'money','value':101792.7,'currency':'USD'},{'type':'money','value':-1688.4000000000087,'currency':'USD'},{'type':'percent','value':-0.016316022925925686},{'type':'percent','value':-0.000027376663613253477}]}]}]}]}]},{'group_name':'Owner (Down)','group_value':'Directly Owned','level':2,'values':[{'type':'money','value':42028564.1595874,'currency':'USD'},{'type':'money','value':42445645.1703414,'currency':'USD'},{'type':'money','value':42336451.914816,'currency':'USD'},{'type':'money','value':-490732.6747303987,'currency':'USD'},{'type':'percent','value':-0.011509297500501158},{'type':'percent','value':-0.007957014546390778}],'children':[{'group_name':'Holding Status','group_value':'Current Holding','level':3,'values':[{'type':'money','value':42028564.1595874,'currency':'USD'},{'type':'money','value':42445645.1703414,'currency':'USD'},{'type':'money','value':42336451.914816,'currency':'USD'},{'type':'money','value':-490732.6747303987,'currency':'USD'},{'type':'percent','value':-0.011509297500501158},{'type':'percent','value':-0.007957014546390778}],'children':[{'group_name':'Asset Class','group_value':'Cash & Cash Equivalents','level':4,'values':[{'type':'money','value':4522893,'currency':'USD'},{'type':'money','value':3584496,'currency':'USD'},{'type':'money','value':4048725,'currency':'USD'},{'type':'money','value':-2,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':-3.2429120603237784e-8}],'children':[{'group_name':'Security','group_value':'Cash','level':5,'values':[{'type':'money','value':4522893,'currency':'USD'},{'type':'money','value':3584496,'currency':'USD'},{'type':'money','value':4048725,'currency':'USD'},{'type':'money','value':-2,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':-3.2429120603237784e-8}]}]},{'group_name':'Asset Class','group_value':'Equity','level':4,'values':[{'type':'money','value':14354363.1840884,'currency':'USD'},{'type':'money','value':15577473.865274899,'currency':'USD'},{'type':'money','value':15033957.5173331,'currency':'USD'},{'type':'money','value':-507398.5953467991,'currency':'USD'},{'type':'percent','value':-0.03259330821114757},{'type':'percent','value':-0.008227245121207396}],'children':[{'group_name':'Security','group_value':'Hewlett-Packard Company','level':5,'values':[{'type':'money','value':492659.6758712,'currency':'USD'},{'type':'money','value':507340.32410729997,'currency':'USD'},{'type':'money','value':532888.4651935,'currency':'USD'},{'type':'money','value':25548.141086200078,'currency':'USD'},{'type':'percent','value':0.05035700864336731},{'type':'percent','value':0.0004142518742364583}]},{'group_name':'Security','group_value':'Johnson & Johnson','level':5,'values':[{'type':'money','value':994124.922925,'currency':'USD'},{'type':'money','value':995516.3886025001,'currency':'USD'},{'type':'money','value':1000618.4294200001,'currency':'USD'},{'type':'money','value':13914.65677250002,'currency':'USD'},{'type':'percent','value':0.013997949380945998},{'type':'percent','value':0.00022562004131403127}]},{'group_name':'Security','group_value':'Las Vegas Sands Corp.','level':5,'values':[{'type':'money','value':2498796.6305316,'currency':'USD'},{'type':'money','value':2824909.747254,'currency':'USD'},{'type':'money','value':2810469.3140412,'currency':'USD'},{'type':'money','value':-14440.433212799951,'currency':'USD'},{'type':'percent','value':-0.005111821086261964},{'type':'percent','value':-0.00023414527511044503}]},{'group_name':'Security','group_value':'McDonald','level':5,'values':[{'type':'money','value':1552883.0833780998,'currency':'USD'},{'type':'money','value':1478974.1952165,'currency':'USD'},{'type':'money','value':1521503.6631888,'currency':'USD'},{'type':'money','value':53679.5157623,'currency':'USD'},{'type':'percent','value':0.03630421027233325},{'type':'percent','value':0.0008703897452895151}]},{'group_name':'Security','group_value':'Microsoft','level':5,'values':[{'type':'money','value':840064.62046,'currency':'USD'},{'type':'money','value':860420.0324172999,'currency':'USD'},{'type':'money','value':826494.3458218,'currency':'USD'},{'type':'money','value':-17770.59774550004,'currency':'USD'},{'type':'percent','value':-0.020849854094320323},{'type':'percent','value':-0.00028814242874022314}]},{'group_name':'Security','group_value':'Netflix, Inc','level':5,'values':[{'type':'money','value':1305534.7794962,'currency':'USD'},{'type':'money','value':1534779.3569328,'currency':'USD'},{'type':'money','value':1206619.2970623001,'currency':'USD'},{'type':'money','value':-328160.0598704999,'currency':'USD'},{'type':'percent','value':-0.21381578947368413},{'type':'percent','value':-0.005320971079353086}]},{'group_name':'Security','group_value':'Oracle Corporation','level':5,'values':[{'type':'money','value':1175452.7162349,'currency':'USD'},{'type':'money','value':1318712.2735713,'currency':'USD'},{'type':'money','value':1261569.4164314999,'currency':'USD'},{'type':'money','value':-57142.85713980021,'currency':'USD'},{'type':'percent','value':-0.04333231614281371},{'type':'percent','value':-0.0009265463029000841}]},{'group_name':'Security','group_value':'Procter & Gamble Company','level':5,'values':[{'type':'money','value':1065772.2510156,'currency':'USD'},{'type':'money','value':1046956.8059946,'currency':'USD'},{'type':'money','value':1056446.3347878,'currency':'USD'},{'type':'money','value':9489.52879319992,'currency':'USD'},{'type':'percent','value':0.00906391623691194},{'type':'percent','value':0.00015386853685128886}]},{'group_name':'Security','group_value':'Salesforce.Com','level':5,'values':[{'type':'money','value':1430900.8288592002,'currency':'USD'},{'type':'money','value':1779871.6923143999,'currency':'USD'},{'type':'money','value':1582731.8900944002,'currency':'USD'},{'type':'money','value':-197139.80221999972,'currency':'USD'},{'type':'percent','value':-0.11076068183524804},{'type':'percent','value':-0.0031965352109454073}]},{'group_name':'Security','group_value':'Sysco Corp.','level':5,'values':[{'type':'money','value':1028469.7508289999,'currency':'USD'},{'type':'money','value':986476.8682691999,'currency':'USD'},{'type':'money','value':1015658.3629293999,'currency':'USD'},{'type':'money','value':29181.494660200085,'currency':'USD'},{'type':'percent','value':0.029581529581529674},{'type':'percent','value':0.00047316510485918394}]},{'group_name':'Security','group_value':'Vmware, Inc','level':5,'values':[{'type':'money','value':1969703.9244875999,'currency':'USD'},{'type':'money','value':2243516.180595,'currency':'USD'},{'type':'money','value':2218957.9983624,'currency':'USD'},{'type':'money','value':-24558.182232599705,'currency':'USD'},{'type':'percent','value':-0.010946291560102172},{'type':'percent','value':-0.0003982001267086336}]}]},{'group_name':'Asset Class','group_value':'Alternatives','level':4,'values':[{'type':'money','value':23151307.975499,'currency':'USD'},{'type':'money','value':23283675.3050665,'currency':'USD'},{'type':'money','value':23253769.3974829,'currency':'USD'},{'type':'money','value':16667.920616400195,'currency':'USD'},{'type':'percent','value':0.0007170712230973364},{'type':'percent','value':0.0002702630039372177}],'children':[{'group_name':'Security','group_value':'Accel Internet Venture Fund Vi LP','level':5,'values':[{'type':'money','value':1100000,'currency':'USD'},{'type':'money','value':1100000,'currency':'USD'},{'type':'money','value':1100000,'currency':'USD'},{'type':'money','value':0,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':0}]},{'group_name':'Security','group_value':'Anything But The Usd, LP','level':5,'values':[{'type':'money','value':1597770,'currency':'USD'},{'type':'money','value':1664190,'currency':'USD'},{'type':'money','value':1616548,'currency':'USD'},{'type':'money','value':-45288.60000000009,'currency':'USD'},{'type':'percent','value':-0.027250853198422898},{'type':'percent','value':-0.0007343347356758988}]},{'group_name':'Security','group_value':'Apollo Investment Fund V','level':5,'values':[{'type':'money','value':1614907,'currency':'USD'},{'type':'money','value':1614907,'currency':'USD'},{'type':'money','value':1614907,'currency':'USD'},{'type':'money','value':0,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':0}]},{'group_name':'Security','group_value':'Blackstone Communications I','level':5,'values':[{'type':'money','value':1522387,'currency':'USD'},{'type':'money','value':1522387,'currency':'USD'},{'type':'money','value':1522387,'currency':'USD'},{'type':'money','value':0,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':0}]},{'group_name':'Security','group_value':'Blue Ridge','level':5,'values':[{'type':'money','value':1335005,'currency':'USD'},{'type':'money','value':1335005,'currency':'USD'},{'type':'money','value':1335005,'currency':'USD'},{'type':'money','value':0,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':0}]},{'group_name':'Security','group_value':'Brevan Howard Master Fund LP','level':5,'values':[{'type':'money','value':1652094,'currency':'USD'},{'type':'money','value':1652094,'currency':'USD'},{'type':'money','value':1652094,'currency':'USD'},{'type':'money','value':0,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':0}]},{'group_name':'Security','group_value':'Bridgewater All Weather 12% Strategy LP','level':5,'values':[{'type':'money','value':1012502,'currency':'USD'},{'type':'money','value':1012502,'currency':'USD'},{'type':'money','value':1012502,'currency':'USD'},{'type':'money','value':0,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':0}]},{'group_name':'Security','group_value':'Buckeye Partners LP','level':5,'values':[{'type':'money','value':1109712.230167,'currency':'USD'},{'type':'money','value':1214928.0575004998,'currency':'USD'},{'type':'money','value':1147482.014338,'currency':'USD'},{'type':'money','value':-49010.79136249982,'currency':'USD'},{'type':'percent','value':-0.040775699586931786},{'type':'percent','value':-0.0007946884319773157}]},{'group_name':'Security','group_value':'Citadel Kensington Global Strategies LTD','level':5,'values':[{'type':'money','value':757000,'currency':'USD'},{'type':'money','value':757000,'currency':'USD'},{'type':'money','value':757000,'currency':'USD'},{'type':'money','value':0,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':0}]},{'group_name':'Security','group_value':'Debt Collectors, LP','level':5,'values':[{'type':'money','value':1574468,'currency':'USD'},{'type':'money','value':1594264,'currency':'USD'},{'type':'money','value':1538404,'currency':'USD'},{'type':'money','value':-48686.39999999991,'currency':'USD'},{'type':'percent','value':-0.0306673372406235},{'type':'percent','value':-0.0007894285686687365}]},{'group_name':'Security','group_value':'Enterprise Products Partners LP','level':5,'values':[{'type':'money','value':1371708.5119359998,'currency':'USD'},{'type':'money','value':1372627.0667430998,'currency':'USD'},{'type':'money','value':1392835.2724993,'currency':'USD'},{'type':'money','value':20208.205756200245,'currency':'USD'},{'type':'percent','value':0.014722284184697928},{'type':'percent','value':0.00032766717082143086}]},{'group_name':'Security','group_value':'GS Capital Partners V LP','level':5,'values':[{'type':'money','value':523468,'currency':'USD'},{'type':'money','value':523468,'currency':'USD'},{'type':'money','value':523468,'currency':'USD'},{'type':'money','value':0,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':0}]},{'group_name':'Security','group_value':'GS Distressed Opportunities Fund III','level':5,'values':[{'type':'money','value':305263,'currency':'USD'},{'type':'money','value':305263,'currency':'USD'},{'type':'money','value':305263,'currency':'USD'},{'type':'money','value':0,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':0}]},{'group_name':'Security','group_value':'Horseman Global Fund LTD','level':5,'values':[{'type':'money','value':600000,'currency':'USD'},{'type':'money','value':600000,'currency':'USD'},{'type':'money','value':600000,'currency':'USD'},{'type':'money','value':0,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':0}]},{'group_name':'Security','group_value':'Kinder Morgan Energy Partners, LP','level':5,'values':[{'type':'money','value':1273574.2973384,'currency':'USD'},{'type':'money','value':1220722.8917097,'currency':'USD'},{'type':'money','value':1256224.899746,'currency':'USD'},{'type':'money','value':35502.008036300074,'currency':'USD'},{'type':'percent','value':0.029082774049217063},{'type':'percent','value':0.000575649450133146}]},{'group_name':'Security','group_value':'Kinder Morgan Management, LLC','level':5,'values':[{'type':'money','value':1308675.3063251998,'currency':'USD'},{'type':'money','value':1192224.6223487998,'currency':'USD'},{'type':'money','value':1273758.0996923998,'currency':'USD'},{'type':'money','value':81533.47734360001,'currency':'USD'},{'type':'percent','value':0.0683876811594203},{'type':'percent','value':0.00132202948498848}]},{'group_name':'Security','group_value':'KKR 2006 Fund LP','level':5,'values':[{'type':'money','value':823100,'currency':'USD'},{'type':'money','value':823100,'currency':'USD'},{'type':'money','value':823100,'currency':'USD'},{'type':'money','value':0,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':0}]},{'group_name':'Security','group_value':'Paulson Credit Opportunities','level':5,'values':[{'type':'money','value':368500,'currency':'USD'},{'type':'money','value':368500,'currency':'USD'},{'type':'money','value':368500,'currency':'USD'},{'type':'money','value':0,'currency':'USD'},{'type':'percent','value':0},{'type':'percent','value':0}]},{'group_name':'Security','group_value':'Plains All American Pipeline, L.P.','level':5,'values':[{'type':'money','value':1284629.6297324002,'currency':'USD'},{'type':'money','value':1221666.6667644,'currency':'USD'},{'type':'money','value':1201111.1112072,'currency':'USD'},{'type':'money','value':-1943.9791572000831,'currency':'USD'},{'type':'percent','value':-0.0016142062729210425},{'type':'percent','value':-0.00003152076726951102}]},{'group_name':'Security','group_value':'Trading Places, LP','level':5,'values':[{'type':'money','value':2016544,'currency':'USD'},{'type':'money','value':2188826,'currency':'USD'},{'type':'money','value':2213180,'currency':'USD'},{'type':'money','value':24354,'currency':'USD'},{'type':'percent','value':0.011126512568838271},{'type':'percent','value':0.00039488940158562645}]}]}]}]}]}]},'grouping_factors':[{'display_name':'Owner (Down)','is_time_series':false,'template_id':'down_factor'},{'display_name':'Holding Status','is_time_series':false,'template_id':'holding_period_factor'},{'display_name':'Asset Class','is_time_series':false,'template_id':'asset_class_factor'},{'display_name':'Security','is_time_series':false,'template_id':'security_factor'}],'value_factors':[{'display_name':'Current Value (Native Currency)','is_time_series':false,'template_id':'personal_value_factor'},{'display_name':'Adjusted Value 11/1/2012 (USD)','is_time_series':false,'template_id':'personal_value_factor'},{'display_name':'Adjusted Value 11/30/2011 (USD)','is_time_series':false,'template_id':'personal_value_factor'},{'display_name':'Adjusted Total Return Nov. 2011 (USD)','is_time_series':false,'template_id':'absolute_gain_factor'},{'display_name':'Adjusted Total Return (%) Nov. 2011 (USD)','is_time_series':false,'template_id':'percent_gain_factor'},{'display_name':'Adjusted Performance Attribution Nov. 2011 (USD) ','is_time_series':false,'template_id':'contribution_to_portfolio_factor'}]};

});
define('dummy/router', ['exports', 'ember', 'dummy/config/environment'], function (exports, Ember, config) {

  'use strict';

  var Router = Ember['default'].Router.extend({
    location: config['default'].locationType
  });

  Router.map(function () {
    this.route('overview');
    this.route('documentation');
    this.route('migration-guides');

    this.route('simple');
    this.route('ajax');
    this.route('bars');
    this.route('dynamic-bars');
    this.route('financial');
    this.route('editable');
    this.route('sparkline');
    this.route('horizon');
    this.route('configurable-columns');

    this.route('community-examples');

    this.route('license');
  });

  exports['default'] = Router;

});
define('dummy/routes/index', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Route.extend({
    redirect: function redirect() {
      this.transitionTo('overview');
    }
  });

});
define('dummy/routes/overview', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].Route.extend({
    activate: function activate() {
      var controller = this.controllerFor('application');
      controller.set('showLargeHero', true);
    },

    deactivate: function deactivate() {
      var controller = this.controllerFor('application');
      controller.set('showLargeHero', false);
    }
  });

});
define('dummy/templates/ajax-table/ajax-cell', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("img");
          dom.setAttribute(el1,"width","30");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, element = hooks.element;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var element0 = dom.childAt(fragment, [1]);
          element(env, element0, context, "bind-attr", [], {"src": "view.cellContent"});
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("img");
          dom.setAttribute(el1,"src","images/loading.gif");
          dom.setAttribute(el1,"style","padding: 8px;");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, null);
        dom.insertBoundary(fragment, 0);
        block(env, morph0, context, "if", [get(env, context, "view.row.isLoaded")], {}, child0, child1);
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/ajax-table/ajax-table', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        inline(env, morph0, context, "ember-table", [], {"hasHeader": true, "hasFooter": false, "numFixedColumns": 0, "numRows": 100, "rowHeight": 35, "columns": get(env, context, "tableColumns"), "content": get(env, context, "tableContent")});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/ajax', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","col-md-10 col-md-offset-2 left-border main-content-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h1");
        var el3 = dom.createTextNode("Ember Table ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("small");
        var el4 = dom.createTextNode("Ajax Cells");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","example-container");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("div");
        dom.setAttribute(el5,"class","ember-table-example-container");
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","example-description");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        dom.setAttribute(el5,"class","reduced");
        var el6 = dom.createTextNode("Ember-Table with ajax cells.");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Template");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-html");
        var el6 = dom.createTextNode("{{ember-table\n  hasHeader=true\n  hasFooter=false\n  numFixedColumns=0\n  numRows=100\n  rowHeight=35\n  columns=tableColumns\n  content=tableContent\n}}\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Controller");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import Ember from &#39;ember&#39;;\nimport ColumnDefinition from &#39;ember-table&#x2F;models&#x2F;column-definition&#39;;\nimport AjaxTableLazyDataSource from\n  &#39;..&#x2F;views&#x2F;ajax-table-lazy-data-source&#39;;\n\nexport default Ember.Controller.extend({\n  tableColumns: Ember.computed(function() {\n    var avatar = ColumnDefinition.create({\n      savedWidth: 80,\n      headerCellName: &#39;avatar&#39;,\n      tableCellViewClass: &#39;ajax-image-table-cell&#39;,\n      contentPath: &#39;avatar&#39;\n    });\n    var columnNames = [&#39;login&#39;, &#39;type&#39;, &#39;createdAt&#39;];\n    var columns = columnNames.map(function(key) {\n      return ColumnDefinition.create({\n        savedWidth: 150,\n        headerCellName: key.w(),\n        contentPath: key\n      });\n    });\n    columns.unshift(avatar);\n    return columns;\n  }),\n\n  tableContent: Ember.computed(function() {\n    return AjaxTableLazyDataSource.create({\n      content: new Array(100)\n    });\n  })\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("views/ajax-image-table-cell.js");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import TableCell from &#39;ember-table&#x2F;views&#x2F;table-cell&#39;;\n\nexport default TableCell.extend({\n  templateName: &#39;ajax-table&#x2F;ajax-cell&#39;,\n  classNames: &#39;img-table-cell&#39;\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("templates/ajax-table/ajax-cell.hbs");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-html");
        var el6 = dom.createTextNode("{{#if view.row.isLoaded}}\n  &lt;img width=&quot;30&quot; {{bind-attr src=&quot;view.cellContent&quot;}}&#x2F;&gt;\n{{else}}\n  &lt;img src=&quot;images&#x2F;loading.gif&quot; style=&quot;padding: 8px;&quot;&#x2F;&gt;\n{{&#x2F;if}}\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("views/ajax-table-lazy-data-source.js");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import Ember from &#39;ember&#39;;\n\nexport default Ember.ArrayProxy.extend({\n  createGithubEvent: function(row, event) {\n    row.set(&#39;type&#39;, event.type);\n    row.set(&#39;createdAt&#39;, event.created_at);\n    row.set(&#39;login&#39;, event.actor.login);\n    row.set(&#39;avatar&#39;, event.actor.avatar_url);\n    row.set(&#39;isLoaded&#39;, true);\n    return row;\n  },\n\n  requestGithubEvent: function(page) {\n    var _this = this;\n    var content = this.get(&#39;content&#39;);\n    var start = (page - 1) * 30;\n    var end = start + 30;\n    var url = &#39;https:&#x2F;&#x2F;api.github.com&#x2F;repos&#x2F;emberjs&#x2F;ember.js&#x2F;events?page=&#39; +\n      page + &#39;&amp;per_page=30&amp;callback=?&#39;;\n    Ember.$.getJSON(url, function(json) {\n      return json.data.forEach(function(event, index) {\n        var row = content[start + index];\n        return _this.createGithubEvent(row, event);\n      });\n    });\n    for (var index = start; index &lt; end; index++) {\n      content[index] = Ember.Object.create({\n        eventId: index,\n        isLoaded: false\n      });\n    }\n  },\n\n  objectAt: function(index) {\n    var content = this.get(&#39;content&#39;);\n    var row = content[index];\n    if (row &amp;&amp; !row.get(&#39;error&#39;)) {\n      return row;\n    }\n    this.requestGithubEvent(Math.floor(index &#x2F; 30 + 1));\n    return content[index];\n  }\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0, 3, 1, 1, 1]),1,1);
        inline(env, morph0, context, "partial", ["ajax-table/ajax-table"], {});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/application', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","hero-container");
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2,"class","hero table-hero");
          var el3 = dom.createTextNode("\n      ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","hero-overlay");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n    ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2,"class","container hero-content-container");
          var el3 = dom.createTextNode("\n      ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","row");
          var el4 = dom.createTextNode("\n        ");
          dom.appendChild(el3, el4);
          var el4 = dom.createElement("div");
          dom.setAttribute(el4,"class","span12 hero-tagline center-align hidden-tablet");
          var el5 = dom.createTextNode("\n          ");
          dom.appendChild(el4, el5);
          var el5 = dom.createElement("h1");
          dom.setAttribute(el5,"class","elevated");
          var el6 = dom.createTextNode("Ember Table");
          dom.appendChild(el5, el6);
          dom.appendChild(el4, el5);
          var el5 = dom.createTextNode("\n          ");
          dom.appendChild(el4, el5);
          var el5 = dom.createElement("p");
          dom.setAttribute(el5,"class","elevated");
          var el6 = dom.createTextNode("A fast, lazy rendered, easily extensible table built with Ember.js.");
          dom.appendChild(el5, el6);
          var el6 = dom.createElement("br");
          dom.appendChild(el5, el6);
          var el6 = dom.createElement("br");
          dom.appendChild(el5, el6);
          var el6 = dom.createElement("a");
          dom.setAttribute(el6,"target","_BLANK");
          dom.setAttribute(el6,"href","https://github.com/Addepar/ember-table/releases");
          dom.setAttribute(el6,"class","addepar-btn addepar-btn-large addepar-btn-outline addepar-btn-white");
          var el7 = dom.createTextNode("Download Ember-Table");
          dom.appendChild(el6, el7);
          dom.appendChild(el5, el6);
          dom.appendChild(el4, el5);
          var el5 = dom.createTextNode("\n        ");
          dom.appendChild(el4, el5);
          dom.appendChild(el3, el4);
          var el4 = dom.createTextNode("\n      ");
          dom.appendChild(el3, el4);
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n    ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n  ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","hero-container small-hero-container");
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("div");
          dom.setAttribute(el2,"class","hero table-hero");
          var el3 = dom.createTextNode("\n      ");
          dom.appendChild(el2, el3);
          var el3 = dom.createElement("div");
          dom.setAttribute(el3,"class","hero-overlay");
          dom.appendChild(el2, el3);
          var el3 = dom.createTextNode("\n    ");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n  ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row");
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline, get = hooks.get, block = hooks.block, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [4, 1]);
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        var morph1 = dom.createMorphAt(fragment,2,2,contextualElement);
        var morph2 = dom.createMorphAt(element0,1,1);
        var morph3 = dom.createMorphAt(element0,3,3);
        var morph4 = dom.createMorphAt(fragment,6,6,contextualElement);
        dom.insertBoundary(fragment, 0);
        inline(env, morph0, context, "partial", ["navigation"], {});
        block(env, morph1, context, "if", [get(env, context, "showLargeHero")], {}, child0, child1);
        inline(env, morph2, context, "partial", ["sub-navigation"], {});
        content(env, morph3, context, "outlet");
        inline(env, morph4, context, "partial", ["footer"], {});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/bar-table/bar-cell', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("span");
        dom.setAttribute(el1,"class","bar-cell");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, element = hooks.element;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0]);
        element(env, element0, context, "bind-attr", [], {"style": "view.histogramStyle"});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/bar-table/bar-table', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        inline(env, morph0, context, "ember-table", [], {"hasHeader": true, "hasFooter": false, "rowHeight": 30, "columns": get(env, context, "tableColumns"), "content": get(env, context, "tableContent")});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/bars', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","col-md-10 col-md-offset-2 left-border main-content-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h1");
        var el3 = dom.createTextNode("Ember Table ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("small");
        var el4 = dom.createTextNode("D3 Chart Table Cells");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","example-container");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("div");
        dom.setAttribute(el5,"class","ember-table-example-container");
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Template");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-html");
        var el6 = dom.createTextNode("{{ember-table\n  hasHeader=true\n  hasFooter=false\n  rowHeight=30\n  columns=tableColumns\n  content=tableContent\n}}\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Controller");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import Ember from &#39;ember&#39;;\nimport ColumnDefinition from &#39;ember-table&#x2F;models&#x2F;column-definition&#39;;\n\nexport default Ember.Controller.extend({\n  tableColumns: Ember.computed(function() {\n    var colors = [&#39;blue&#39;, &#39;teal&#39;, &#39;green&#39;, &#39;yellow&#39;, &#39;orange&#39;];\n    var firstColumn = ColumnDefinition.create({\n      savedWidth: 50,\n      headerCellName: &#39;Name&#39;,\n      contentPath: &#39;key&#39;\n    });\n    var columns = colors.map(function(color, index) {\n      return ColumnDefinition.create({\n        color: color,\n        headerCellName: &#39;Bar&#39;,\n        tableCellViewClass: &#39;bar-table-cell&#39;,\n        contentPath: &#39;value&#39; + (index + 1)\n      });\n    });\n    columns.unshift(firstColumn);\n    return columns;\n  }),\n\n  tableContent: Ember.computed(function() {\n    var content = [];\n    for (var i = 0; i &lt; 100; i++) {\n      content.pushObject({\n        key: i,\n        value1: Math.random() * 80 + 10,\n        value2: Math.random() * 80 + 10,\n        value3: Math.random() * 80 + 10,\n        value4: Math.random() * 80 + 10,\n        value5: Math.random() * 80 + 10\n      });\n    }\n    return content;\n  })\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("views/bar-table-cell.js");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import Ember from &#39;ember&#39;;\nimport TableCell from &#39;ember-table&#x2F;views&#x2F;table-cell&#39;;\n\nexport default TableCell.extend({\n  templateName: &#39;bar_table&#x2F;bar-cell&#39;,\n  classNameBindings: [&#39;column.color&#39;],\n\n  barWidth: Ember.computed(function() {\n    var properties = this.getProperties(&#39;column&#39;, &#39;row&#39;);\n    var column = properties.column;\n    var row = properties.row;\n    if (!(column &amp;&amp; row)) {\n      return 0;\n    }\n    return Math.round(+this.get(&#39;cellContent&#39;));\n  }).property(&#39;column&#39;, &#39;row&#39;, &#39;cellContent&#39;),\n\n  histogramStyle: Ember.computed(function() {\n    return &#39;width: &#39; + (this.get(&#39;barWidth&#39;)) + &#39;%;&#39;;\n  }).property(&#39;barWidth&#39;)\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("templates/bar-table/bar-cell.hbs");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-html");
        var el6 = dom.createTextNode("&lt;span class=&quot;bar-cell&quot; {{bind-attr style=&quot;view.histogramStyle&quot;}}&gt;\n&lt;&#x2F;span&gt;\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0, 3, 1, 1, 1]),1,1);
        inline(env, morph0, context, "partial", ["bar-table/bar-table"], {});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/body-table-container', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("        ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
          inline(env, morph0, context, "view", ["lazy-table-block"], {"classNames": "ember-table-left-table-block", "content": get(env, context, "bodyContent"), "columns": get(env, context, "fixedColumns"), "width": get(env, context, "_fixedBlockWidth"), "numItemsShowing": get(env, context, "_numItemsShowing"), "scrollTop": get(env, context, "_scrollTop"), "startIndex": get(env, context, "_startIndex")});
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","antiscroll-box");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","antiscroll-inner");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","ember-table-table-scrollable-wrapper");
        var el4 = dom.createTextNode("\n");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0, 1, 1]);
        var morph0 = dom.createMorphAt(element0,1,1);
        var morph1 = dom.createMorphAt(element0,3,3);
        block(env, morph0, context, "if", [get(env, context, "numFixedColumns")], {}, child0, null);
        inline(env, morph1, context, "view", ["lazy-table-block"], {"classNames": "ember-table-right-table-block", "content": get(env, context, "bodyContent"), "columns": get(env, context, "tableColumns"), "scrollLeft": get(env, context, "_tableScrollLeft"), "width": get(env, context, "_tableBlockWidth"), "numItemsShowing": get(env, context, "_numItemsShowing"), "scrollTop": get(env, context, "_scrollTop"), "startIndex": get(env, context, "_startIndex")});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/community-examples', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","col-md-10 col-md-offset-2 left-border main-content-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h1");
        var el5 = dom.createTextNode("Community Examples");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        dom.setAttribute(el4,"class","elevated");
        var el5 = dom.createTextNode("Many people have extended ember-table to add new features or customize the way the table works with their app. We hope this list of community-built examples helps to provide inspiration and share commonly used design patterns.");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("br");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("br");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("This is a new list, and we're looking for more examples to add.");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("br");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("If you're willing to share your work here, please ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("a");
        dom.setAttribute(el5,"target","_BLANK");
        dom.setAttribute(el5,"href","https://github.com/Addepar/ember-table/issues");
        var el6 = dom.createTextNode("open a GitHub ticket!");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","row ember-table-examples");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("div");
        dom.setAttribute(el5,"class","col-md-4");
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("h4");
        dom.setAttribute(el6,"class","byline");
        var el7 = dom.createTextNode("Server-side Sorting");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("p");
        dom.setAttribute(el6,"class","byline");
        var el7 = dom.createTextNode("By ");
        dom.appendChild(el6, el7);
        var el7 = dom.createElement("a");
        dom.setAttribute(el7,"target","_BLANK");
        dom.setAttribute(el7,"href","https://github.com/seriousben");
        var el8 = dom.createTextNode("seriousben");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("a");
        dom.setAttribute(el6,"target","_BLANK");
        dom.setAttribute(el6,"href","http://jsbin.com/nefiwoco/15/edit");
        var el7 = dom.createTextNode("\n            ");
        dom.appendChild(el6, el7);
        var el7 = dom.createElement("img");
        dom.setAttribute(el7,"class","preview-box");
        dom.setAttribute(el7,"src","images/community_examples/preview_server_side_sorting.png");
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n          ");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/components/ember-table', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, inline = hooks.inline;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
          inline(env, morph0, context, "view", ["header-table-container"], {});
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("  ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, inline = hooks.inline;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
          inline(env, morph0, context, "view", ["footer-table-container"], {});
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        var morph1 = dom.createMorphAt(fragment,1,1,contextualElement);
        var morph2 = dom.createMorphAt(fragment,3,3,contextualElement);
        var morph3 = dom.createMorphAt(fragment,4,4,contextualElement);
        var morph4 = dom.createMorphAt(fragment,6,6,contextualElement);
        dom.insertBoundary(fragment, 0);
        block(env, morph0, context, "if", [get(env, context, "hasHeader")], {}, child0, null);
        inline(env, morph1, context, "view", ["body-table-container"], {});
        block(env, morph2, context, "if", [get(env, context, "hasFooter")], {}, child1, null);
        inline(env, morph3, context, "view", ["scroll-container"], {});
        inline(env, morph4, context, "view", ["column-sortable-indicator"], {});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/configurable-columns', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("              ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("tr");
          var el2 = dom.createTextNode("\n                ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("td");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n                ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("td");
          dom.setAttribute(el2,"class","checkbox-cell");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n                ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("td");
          dom.setAttribute(el2,"class","checkbox-cell");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n                ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("td");
          dom.setAttribute(el2,"class","checkbox-cell");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n                ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("td");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n                ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("td");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n                ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("td");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n                ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("td");
          var el3 = dom.createComment("");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n              ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, content = hooks.content, get = hooks.get, inline = hooks.inline, element = hooks.element;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var element0 = dom.childAt(fragment, [1]);
          var element1 = dom.childAt(element0, [9]);
          var element2 = dom.childAt(element0, [11]);
          var morph0 = dom.createMorphAt(dom.childAt(element0, [1]),0,0);
          var morph1 = dom.createMorphAt(dom.childAt(element0, [3]),0,0);
          var morph2 = dom.createMorphAt(dom.childAt(element0, [5]),0,0);
          var morph3 = dom.createMorphAt(dom.childAt(element0, [7]),0,0);
          var morph4 = dom.createMorphAt(element1,0,0);
          var morph5 = dom.createMorphAt(element2,0,0);
          var morph6 = dom.createMorphAt(dom.childAt(element0, [13]),0,0);
          var morph7 = dom.createMorphAt(dom.childAt(element0, [15]),0,0);
          content(env, morph0, context, "headerCellName");
          inline(env, morph1, context, "input", [], {"class": "checkbox-input", "type": "checkbox", "checked": get(env, context, "isSortable")});
          inline(env, morph2, context, "input", [], {"class": "checkbox-input", "type": "checkbox", "checked": get(env, context, "isResizable")});
          inline(env, morph3, context, "input", [], {"class": "checkbox-input", "type": "checkbox", "checked": get(env, context, "canAutoResize")});
          element(env, element1, context, "bind-attr", [], {"class": "atMinWidth:at-limit"});
          inline(env, morph4, context, "input", [], {"value": get(env, context, "minWidthValue"), "class": "text-input", "type": "number", "min": "1"});
          element(env, element2, context, "bind-attr", [], {"class": "atMaxWidth:at-limit"});
          inline(env, morph5, context, "input", [], {"value": get(env, context, "maxWidthValue"), "class": "text-input", "type": "number", "min": "1"});
          content(env, morph6, context, "width");
          content(env, morph7, context, "savedWidth");
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("          ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","ember-table-example-container-small");
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(dom.childAt(fragment, [1]),1,1);
          inline(env, morph0, context, "configurable-table", [], {"hasFooter": false, "columnMode": get(env, context, "columnMode"), "columns": get(env, context, "columns"), "content": get(env, context, "content"), "parentWidth": get(env, context, "demoTableWidth")});
          return fragment;
        }
      };
    }());
    var child2 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("\n  columnMode=\"fluid\"");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child3 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, content = hooks.content;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
          dom.insertBoundary(fragment, null);
          content(env, morph0, context, "columnDefinitionDocumentation");
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","col-md-10 col-md-offset-2 left-border main-content-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h1");
        var el3 = dom.createTextNode("Ember Table ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("small");
        var el4 = dom.createTextNode("Configurable Column Demo");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("p");
        var el3 = dom.createTextNode("Ember Table's column settings give you a lot of fine-grained control over\n  reordering and resizing behavior. Use this demo to play with the options and\n  find what works for your use!");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("p");
        var el3 = dom.createTextNode("You can drag the right border of the table container to see how the table\n  should respond to width changes. The refresh button is useful to see how the\n  table would be initialized given the settings you've selected.");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("p");
        var el3 = dom.createTextNode("When you're done configuring, check out the code below - it's updated live\n  with the settings you selected.");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","configuration-container");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("div");
        dom.setAttribute(el5,"class","title-text");
        var el6 = dom.createTextNode("Configure Demo");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("table");
        dom.setAttribute(el5,"class","table table-bordered table-condensed");
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("tbody");
        var el7 = dom.createTextNode("\n            ");
        dom.appendChild(el6, el7);
        var el7 = dom.createElement("tr");
        var el8 = dom.createTextNode("\n              ");
        dom.appendChild(el7, el8);
        var el8 = dom.createElement("th");
        var el9 = dom.createTextNode("Column");
        dom.appendChild(el8, el9);
        dom.appendChild(el7, el8);
        var el8 = dom.createTextNode("\n              ");
        dom.appendChild(el7, el8);
        var el8 = dom.createElement("th");
        dom.setAttribute(el8,"class","checkbox-column");
        var el9 = dom.createTextNode("Reorder");
        dom.appendChild(el8, el9);
        dom.appendChild(el7, el8);
        var el8 = dom.createTextNode("\n              ");
        dom.appendChild(el7, el8);
        var el8 = dom.createElement("th");
        dom.setAttribute(el8,"class","checkbox-column");
        var el9 = dom.createTextNode("Resize");
        dom.appendChild(el8, el9);
        dom.appendChild(el7, el8);
        var el8 = dom.createTextNode("\n              ");
        dom.appendChild(el7, el8);
        var el8 = dom.createElement("th");
        dom.setAttribute(el8,"class","checkbox-column");
        var el9 = dom.createTextNode("Auto-Resize");
        dom.appendChild(el8, el9);
        dom.appendChild(el7, el8);
        var el8 = dom.createTextNode("\n              ");
        dom.appendChild(el7, el8);
        var el8 = dom.createElement("th");
        dom.setAttribute(el8,"class","width-column");
        var el9 = dom.createTextNode("Min Width");
        dom.appendChild(el8, el9);
        dom.appendChild(el7, el8);
        var el8 = dom.createTextNode("\n              ");
        dom.appendChild(el7, el8);
        var el8 = dom.createElement("th");
        dom.setAttribute(el8,"class","width-column");
        var el9 = dom.createTextNode("Max Width");
        dom.appendChild(el8, el9);
        dom.appendChild(el7, el8);
        var el8 = dom.createTextNode("\n              ");
        dom.appendChild(el7, el8);
        var el8 = dom.createElement("th");
        dom.setAttribute(el8,"class","width-column");
        var el9 = dom.createTextNode("Actual Width");
        dom.appendChild(el8, el9);
        dom.appendChild(el7, el8);
        var el8 = dom.createTextNode("\n              ");
        dom.appendChild(el7, el8);
        var el8 = dom.createElement("th");
        dom.setAttribute(el8,"class","width-column");
        var el9 = dom.createTextNode("Saved Width");
        dom.appendChild(el8, el9);
        dom.appendChild(el7, el8);
        var el8 = dom.createTextNode("\n            ");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n");
        dom.appendChild(el6, el7);
        var el7 = dom.createComment("");
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("          ");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("div");
        dom.setAttribute(el5,"class","table-options-footer");
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("div");
        dom.setAttribute(el6,"class","fluid-mode-text");
        var el7 = dom.createTextNode("Fluid Mode");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("button");
        dom.setAttribute(el6,"class","addepar-btn-primary refresh-btn");
        var el7 = dom.createTextNode("Refresh Table");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","example-container js-resizable-container");
        var el5 = dom.createTextNode("\n");
        dom.appendChild(el4, el5);
        var el5 = dom.createComment("");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Template");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-html");
        var el6 = dom.createTextNode("{{table-component\n  hasFooter=false\n  columns=tableColumns\n  content=tableContent");
        dom.appendChild(el5, el6);
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n}}");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Controller");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","lang-js");
        var el6 = dom.createTextNode("\nimport Ember from 'ember';\nimport ColumnDefinition from 'ember-table/models/column-definition';\n\nexport default Ember.Controller.extend({\n  tableColumns: Ember.computed(function() { ");
        dom.appendChild(el5, el6);
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n    return [dateColumn, openColumn, highColumn, lowColumn, closeColumn];\n  }),\n\n  tableContent: Ember.computed(function() {\n    var content = [];\n    var date;\n    for (var i = 0; i < 100; i++) {\n      date = new Date();\n      date.setDate(date.getDate() + i);\n      content.pushObject({\n        date: date,\n        open: Math.random() * 100 - 50,\n        high: Math.random() * 100 - 50,\n        low: Math.random() * 100 - 50,\n        close: Math.random() * 100 - 50,\n        volume: Math.random() * 1000000\n      });\n    }\n    return content;\n  })\n});");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block, inline = hooks.inline, element = hooks.element;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element3 = dom.childAt(fragment, [0]);
        var element4 = dom.childAt(element3, [9, 1, 1]);
        var element5 = dom.childAt(element4, [5]);
        var element6 = dom.childAt(element5, [5]);
        var element7 = dom.childAt(element3, [11]);
        var morph0 = dom.createMorphAt(dom.childAt(element4, [3, 1]),3,3);
        var morph1 = dom.createMorphAt(element5,3,3);
        var morph2 = dom.createMorphAt(dom.childAt(element7, [1, 1]),1,1);
        var morph3 = dom.createMorphAt(dom.childAt(element7, [3, 3, 1]),1,1);
        var morph4 = dom.createMorphAt(dom.childAt(element7, [5, 3, 1]),1,1);
        block(env, morph0, context, "each", [get(env, context, "columns")], {}, child0, null);
        inline(env, morph1, context, "input", [], {"class": "checkbox-input", "type": "checkbox", "checked": get(env, context, "isFluid")});
        element(env, element6, context, "action", ["refreshTable"], {});
        block(env, morph2, context, "if", [get(env, context, "showTable")], {}, child1, null);
        block(env, morph3, context, "if", [get(env, context, "isFluid")], {}, child2, null);
        block(env, morph4, context, "each", [get(env, context, "columns")], {}, child3, null);
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/documentation', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("configurable column\n          demo.");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","col-md-10 col-md-offset-2 left-border main-content-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h1");
        var el3 = dom.createTextNode("API & Documentation");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h2");
        var el3 = dom.createTextNode("Ember.Table.TableComponent Options");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("table");
        dom.setAttribute(el2,"class","table ember-table-options");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("th");
        dom.setAttribute(el4,"style","min-width: 200px;");
        var el5 = dom.createTextNode("Option");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("th");
        dom.setAttribute(el4,"style","min-width: 150px;");
        var el5 = dom.createTextNode("Default");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("th");
        var el5 = dom.createTextNode("Description");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("content ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("b");
        var el6 = dom.createTextNode("(required)");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("[]");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          An array of row objects, or a promise that resolves to an array \n          of row objects (so compatible with ember-data). \n          Usually each row is a hash where the keys are column\n          names and the values are the rows's values. However, could be any\n          object, since each column can define a function to return the column\n          value given the row object. See\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("Ember.Table.ColumnDefinition.getCellContent");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(".\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("columns ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("b");
        var el6 = dom.createTextNode("(required)");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("null");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          An array of column definitions: see\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("Ember.Table.ColumnDefinition");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(".  Allows each column to\n          have its own configuration.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("numFixedColumns");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("0");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          The number of fixed columns on the left side of the table. Fixed\n          columns are always visible, even when the table is scrolled\n          horizontally.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("numFooterRow");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("0");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          The number of footer rows in the table. Footer rows appear at the\n          bottom of the table and are always visible.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("rowHeight");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("30");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          The row height in pixels. A consistent row height is necessary to\n          calculate which rows are being shown, to enable lazy rendering.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("minHeaderHeight");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("30");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          The minimum header height in pixels. Headers will grow in height if\n          given more content than they can display.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("footerHeight");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("30");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("The footer height in pixels.");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("hasHeader");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("true");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("Enables or disables the header block.");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("hasFooter");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("true");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("Enables or disables the footer block.");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("enableColumnReorder");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("true");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          Allow the columns to be rearranged by drag-and-drop. Only columns\n          with ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("isSortable=true");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" (the default setting) will be\n          affected.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("enableContentSelection");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("false");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("Allow users to select the content of table cells.");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("styleBindings");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("'height'");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          Values which are bound to the table's style attr. See\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("Ember.StyleBindingsMixin");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" documentation for more details.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("columnMode");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("'standard'");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          Sets which column resizing behavior to use. Possible values are\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("'standard'");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" (resizing a column pushes or pulls all other\n          columns) and ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("'fluid'");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" (resizing a column steals width\n          from neighboring columns). You can experiment with this behavior in\n          the ");
        dom.appendChild(el5, el6);
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("selectionMode");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("'single'");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          Sets which row selection behavior to follow. Possible values are\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("'none'");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" (clicking on a row does nothing),\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("'single'");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" (clicking on a row selects it and deselects\n          other rows), and ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("'multiple'");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" (multiple rows can be\n          selected through ctrl/cmd-click or shift-click).\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("selection (output)");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("undefined");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          An array of the rows currently selected. If\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("selectionMode");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" is set to ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("'single'");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(", the array\n          will contain either one or zero elements.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h2");
        var el3 = dom.createTextNode("Ember.Table.ColumnDefinition Options");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("table");
        dom.setAttribute(el2,"class","table ember-table-options");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("th");
        dom.setAttribute(el4,"style","min-width: 200px;");
        var el5 = dom.createTextNode("Option");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("th");
        dom.setAttribute(el4,"style","min-width: 150px;");
        var el5 = dom.createTextNode("Default");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("th");
        var el5 = dom.createTextNode("Description");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("headerCellName");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("undefined");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("Name of the column, to be displayed in the header.");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("contentPath");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("undefined");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          Path of the content for this cell. If the row object is a hash of\n          keys and values to specify data for each column,\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("contentPath");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" corresponds to the key. Use either this or\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("getCellContent");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(".\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("minWidth");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("25");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          Minimum column width in pixels. Affects both manual resizing and\n          automatic resizing.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("maxWidth");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("undefined");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          Maximum column width in pixels. Affects both manual resizing and\n          automatic resizing.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("savedWidth");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("150");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          The initial column width in pixels. Updated whenever the column (not\n          window) is resized. Can be persisted.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("isResizable");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("true");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("Whether the column can be manually resized.");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("isSortable");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("true");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          Whether the column can be rearranged with other columns. Only matters\n          if the table's ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("enableColumnReorder");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" property is set to\n          true (the default).\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("textAlign");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("'text-align-right'");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          Alignment of the text in the cell. Possible values are\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("'left'");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(", ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("'center'");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(", and ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("'right'");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(".\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("canAutoResize");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("false");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          Whether the column can automatically resize to fill space in the\n          table.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("headerCellView");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("'Ember.Table.HeaderCell'");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          Override to use a custom view for the header cell. Specified as a\n          string.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("tableCellView");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("'Ember.Table.TableCell'");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          Override to use a custom view for table cells. Specified as a string.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("getCellContent");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("(function)");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          Override to customize how the column gets data from each row object.\n          Given a row, should return a formatted cell value, e.g. $20,000,000.\n          Use either this or ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("contentPath");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(".\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("setCellContent");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("Ember.K");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          Override to maintain a consistent path to update cell values.\n          Recommended to make this a function which takes (row, value) and\n          updates the row value.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h2");
        var el3 = dom.createTextNode("Ember.Table.TableCell Options");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("table");
        dom.setAttribute(el2,"class","table ember-table-options");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("th");
        dom.setAttribute(el4,"style","min-width: 200px;");
        var el5 = dom.createTextNode("Option");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("th");
        dom.setAttribute(el4,"style","min-width: 150px;");
        var el5 = dom.createTextNode("Default");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("th");
        var el5 = dom.createTextNode("Description");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("templateName");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("'table-cell'");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("The name of the template to be rendered into the cell.\n        Used for rendering custom templates.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("classNames");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("['ember-table-cell']");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("The class names applied to the cell. Override to give\n        the cell custom styling (border, background color, etc).");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("classNameBindings");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("'column.textAlign'");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("A binding used to dynamically associate class names\n        with this table cell. E.g. you can bind to a column property\n        to have cell colors or styles vary across columns.");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("styleBindings");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("'width'");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("\n          Values which are bound to the cell's style attr. See\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("Ember.StyleBindingsMixin");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" documentation for more details.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h2");
        var el3 = dom.createTextNode("Ember.Table.HeaderCell Options");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("table");
        dom.setAttribute(el2,"class","table ember-table-options");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("th");
        dom.setAttribute(el4,"style","min-width: 200px;");
        var el5 = dom.createTextNode("Option");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("th");
        dom.setAttribute(el4,"style","min-width: 150px;");
        var el5 = dom.createTextNode("Default");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("th");
        var el5 = dom.createTextNode("Description");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("templateName");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("'header-cell'");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("See description in ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("Ember.Table.TableCell");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(".");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("classNames");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("['ember-table-cell', 'ember-table-header-cell']");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("See description in ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("Ember.Table.TableCell");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(".");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("classNameBindings");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("['column.isSortable:sortable', 'column.textAlign']");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("See description in ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("Ember.Table.TableCell");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(".");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("tr");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("styleBindings");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createTextNode("['width', 'height']");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("td");
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("See description in ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("Ember.Table.TableCell");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(".");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0, 5, 27, 5, 1]),5,5);
        block(env, morph0, context, "link-to", ["configurable-columns"], {}, child0, null);
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/dynamic-bar-table/dynamic-bar-table', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        inline(env, morph0, context, "ember-table", [], {"hasHeader": true, "hasFooter": false, "rowHeight": 30, "columns": get(env, context, "tableColumns"), "content": get(env, context, "tableContent")});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/dynamic-bars', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","col-md-10 col-md-offset-2 left-border main-content-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h1");
        var el3 = dom.createTextNode("Ember Table ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("small");
        var el4 = dom.createTextNode("Dynamic Bar");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","example-container");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("div");
        dom.setAttribute(el5,"class","ember-table-example-container");
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Template");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-html");
        var el6 = dom.createTextNode("{{ember-table\n  hasHeader=true\n  hasFooter=false\n  rowHeight=30\n  columns=tableColumns\n  content=tableContent\n}}\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Controller");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import Ember from &#39;ember&#39;;\nimport ColumnDefinition from &#39;ember-table&#x2F;models&#x2F;column-definition&#39;;\n\nexport default Ember.Controller.extend({\n  &#x2F;&#x2F; TODO(azirbel): Don&#39;t use setInterval in an Ember application\n  init: function() {\n    &#x2F;&#x2F; TODO(azirbel): Call this._super()\n    var _this = this;\n    setInterval(function() {\n      _this.get(&#39;tableContent&#39;).forEach(function(item) {\n        item.set(&#39;value1&#39;, _this.getNextValue(item.get(&#39;value1&#39;)));\n        item.set(&#39;value2&#39;, _this.getNextValue(item.get(&#39;value2&#39;)));\n        item.set(&#39;value3&#39;, _this.getNextValue(item.get(&#39;value3&#39;)));\n        item.set(&#39;value4&#39;, _this.getNextValue(item.get(&#39;value4&#39;)));\n        item.set(&#39;value5&#39;, _this.getNextValue(item.get(&#39;value5&#39;)));\n      });\n    }, 1500);\n  },\n\n  getNextValue: function(current) {\n    current = current + (Math.random() * 10 - 5);\n    current = Math.min(100, current);\n    current = Math.max(0, current);\n    return current;\n  },\n\n  tableColumns: Ember.computed(function() {\n    var colors = [&#39;blue&#39;, &#39;teal&#39;, &#39;green&#39;, &#39;yellow&#39;, &#39;orange&#39;];\n    var firstColumn = ColumnDefinition.create({\n      savedWidth: 50,\n      headerCellName: &#39;Name&#39;,\n      contentPath: &#39;key&#39;\n    });\n    var columns = colors.map(function(color, index) {\n      return ColumnDefinition.create({\n        color: color,\n        headerCellName: &#39;Bar&#39;,\n        tableCellViewClass: &#39;bar-table-cell&#39;,\n        contentPath: &#39;value&#39; + (index + 1)\n      });\n    });\n    columns.unshift(firstColumn);\n    return columns;\n  }),\n\n  tableContent: Ember.computed(function() {\n    var content = [];\n    for (var i = 0; i &lt; 100; i++) {\n      content.pushObject(Ember.Object.create({\n        key: i,\n        value1: Math.random() * 80 + 10,\n        value2: Math.random() * 80 + 10,\n        value3: Math.random() * 80 + 10,\n        value4: Math.random() * 80 + 10,\n        value5: Math.random() * 80 + 10\n      }));\n    }\n    return content;\n  })\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("views/bar-table-cell.js");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import Ember from &#39;ember&#39;;\nimport TableCell from &#39;ember-table&#x2F;views&#x2F;table-cell&#39;;\n\nexport default TableCell.extend({\n  templateName: &#39;bar_table&#x2F;bar-cell&#39;,\n  classNameBindings: [&#39;column.color&#39;],\n\n  barWidth: Ember.computed(function() {\n    var properties = this.getProperties(&#39;column&#39;, &#39;row&#39;);\n    var column = properties.column;\n    var row = properties.row;\n    if (!(column &amp;&amp; row)) {\n      return 0;\n    }\n    return Math.round(+this.get(&#39;cellContent&#39;));\n  }).property(&#39;column&#39;, &#39;row&#39;, &#39;cellContent&#39;),\n\n  histogramStyle: Ember.computed(function() {\n    return &#39;width: &#39; + (this.get(&#39;barWidth&#39;)) + &#39;%;&#39;;\n  }).property(&#39;barWidth&#39;)\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("templates/bar-table/bar-cell.hbs");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-html");
        var el6 = dom.createTextNode("&lt;span class=&quot;bar-cell&quot; {{bind-attr style=&quot;view.histogramStyle&quot;}}&gt;\n&lt;&#x2F;span&gt;\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0, 3, 1, 1, 1]),1,1);
        inline(env, morph0, context, "partial", ["dynamic-bar-table/dynamic-bar-table"], {});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/editable-table/editable-table-cell', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
          inline(env, morph0, context, "view", [get(env, context, "view.innerTextField")], {});
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("span");
          dom.setAttribute(el1,"class","content");
          var el2 = dom.createComment("");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, content = hooks.content;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(dom.childAt(fragment, [1]),0,0);
          content(env, morph0, context, "view.cellContent");
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("span");
        dom.setAttribute(el1,"class","ember-table-content");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0]),1,1);
        block(env, morph0, context, "if", [get(env, context, "view.isEditing")], {}, child0, child1);
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/editable-table/editable-table', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        inline(env, morph0, context, "ember-table", [], {"hasHeader": true, "hasFooter": false, "numFixedColumns": 0, "rowHeight": 30, "columns": get(env, context, "tableColumns"), "content": get(env, context, "tableContent")});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/editable-table/rating-table-cell', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","rating");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/editable', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","col-md-10 col-md-offset-2 left-border main-content-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h1");
        var el3 = dom.createTextNode("Ember Table ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("small");
        var el4 = dom.createTextNode("Editable");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","example-container");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("div");
        dom.setAttribute(el5,"class","ember-table-example-container");
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Template");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-html");
        var el6 = dom.createTextNode("{{ember-table\n  hasHeader=true\n  hasFooter=false\n  numFixedColumns=0\n  rowHeight=30\n  columns=tableColumns\n  content=tableContent\n}}\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Controller");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import Ember from &#39;ember&#39;;\nimport ColumnDefinition from &#39;ember-table&#x2F;models&#x2F;column-definition&#39;;\n\nexport default Ember.Controller.extend({\n  tableColumns: Ember.computed(function() {\n    var columnNames = [&#39;open&#39;, &#39;close&#39;];\n    var dateColumn = ColumnDefinition.create({\n      savedWidth: 100,\n      headerCellName: &#39;Date&#39;,\n      tableCellViewClass: &#39;date-picker-table-cell&#39;,\n      getCellContent: function(row) {\n        return row.get(&#39;date&#39;).toString(&#39;yyyy-MM-dd&#39;);\n      },\n      setCellContent: function(row, value) {\n        return row.set(&#39;date&#39;, value);\n      }\n    });\n    var ratingColumn = ColumnDefinition.create({\n      savedWidth: 150,\n      headerCellName: &#39;Analyst Rating&#39;,\n      tableCellViewClass: &#39;rating-table-cell&#39;,\n      contentPath: &#39;rating&#39;,\n      setCellContent: function(row, value) {\n        return row.set(&#39;rating&#39;, value);\n      }\n    });\n    var columns = columnNames.map(function(key) {\n      var name;\n      name = key.charAt(0).toUpperCase() + key.slice(1);\n      return ColumnDefinition.create({\n        savedWidth: 100,\n        headerCellName: name,\n        tableCellViewClass: &#39;editable-table-cell&#39;,\n        getCellContent: function(row) {\n          return row.get(key).toFixed(2);\n        },\n        setCellContent: function(row, value) {\n          return row.set(key, +value);\n        }\n      });\n    });\n    columns.unshift(ratingColumn);\n    columns.unshift(dateColumn);\n    return columns;\n  }),\n\n  tableContent: Ember.computed(function() {\n    var content = [];\n    var date;\n    for (var i = 0; i &lt; 100; i++) {\n      date = new Date();\n      date.setDate(date.getDate() + i);\n      content.pushObject({\n        index: i,\n        date: date,\n        open: Math.random() * 100 - 50,\n        close: Math.random() * 100 - 50,\n        rating: Math.round(Math.random() * 4)\n      });\n    }\n    return content;\n  })\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("views/editable_table_cell.js");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import Ember from &#39;ember&#39;;\nimport TableCell from &#39;ember-table&#x2F;views&#x2F;table-cell&#39;;\n\nexport default TableCell.extend({\n  className: &#39;editable-table-cell&#39;,\n  templateName: &#39;editable-table&#x2F;editable-table-cell&#39;,\n  isEditing: false,\n  type: &#39;text&#39;,\n\n  innerTextField: Ember.TextField.extend({\n    typeBinding: &#39;parentView.type&#39;,\n    valueBinding: &#39;parentView.cellContent&#39;,\n    didInsertElement: function() {\n      this.$().focus();\n      &#x2F;&#x2F; TODO(azirbel): Call this._super()\n    },\n    focusOut: function() {\n      this.set(&#39;parentView.isEditing&#39;, false);\n    }\n  }),\n\n  onRowContentDidChange: Ember.observer(function() {\n    this.set(&#39;isEditing&#39;, false);\n  }, &#39;row.content&#39;),\n\n  click: function(event) {\n    this.set(&#39;isEditing&#39;, true);\n    event.stopPropagation();\n  }\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("templates/editable-table/editable_table_cell.hbs");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-html");
        var el6 = dom.createTextNode("&lt;span class=&quot;ember-table-content&quot;&gt;\n  {{#if view.isEditing}}\n    {{view view.innerTextField}}\n  {{else}}\n    &lt;span class=&#39;content&#39;&gt;{{view.cellContent}}&lt;&#x2F;span&gt;\n  {{&#x2F;if}}\n&lt;&#x2F;span&gt;");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("templates/editable-table/rating_table_cell.hbs");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-html");
        var el6 = dom.createTextNode("&lt;div class=&quot;rating&quot;&gt;\n  &lt;span&gt;&lt;&#x2F;span&gt;&lt;span&gt;&lt;&#x2F;span&gt;&lt;span&gt;&lt;&#x2F;span&gt;&lt;span&gt;&lt;&#x2F;span&gt;&lt;span&gt;&lt;&#x2F;span&gt;\n&lt;&#x2F;div&gt;");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0, 3, 1, 1, 1]),1,1);
        inline(env, morph0, context, "partial", ["editable-table/editable-table"], {});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/empty-cell', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/financial-table/financial-table-cell', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","ember-table-cell-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        dom.setAttribute(el2,"class","ember-table-content");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0, 1]),1,1);
        content(env, morph0, context, "view.cellContent");
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/financial-table/financial-table-header-cell', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","ember-table-cell-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","ember-table-header-content-container");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("span");
        dom.setAttribute(el3,"class","ember-table-content");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0, 1, 1]),1,1);
        content(env, morph0, context, "view.content.headerCellName");
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/financial-table/financial-table-header-tree-cell', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","ember-table-cell-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","ember-table-header-content-container");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("span");
        dom.setAttribute(el3,"class","ember-table-content");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, element = hooks.element, inline = hooks.inline, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0]);
        var element1 = dom.childAt(element0, [1]);
        var morph0 = dom.createMorphAt(element1,1,1);
        var morph1 = dom.createMorphAt(dom.childAt(element0, [3, 1]),1,1);
        element(env, element1, context, "bind-attr", [], {"class": ":ember-table-toggle-span :ember-table-toggle\n      isCollapsed:ember-table-expand:ember-table-collapse"});
        element(env, element1, context, "action", ["toggleTableCollapse"], {});
        inline(env, morph0, context, "fa-icon", ["caret-down"], {"classNames": "ember-table-toggle-icon"});
        content(env, morph1, context, "view.column.headerCellName");
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/financial-table/financial-table-tree-cell', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","ember-table-cell-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        dom.setAttribute(el2,"class","ember-table-content");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, element = hooks.element, get = hooks.get, inline = hooks.inline, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0]);
        var element1 = dom.childAt(element0, [1]);
        var morph0 = dom.createMorphAt(element1,1,1);
        var morph1 = dom.createMorphAt(dom.childAt(element0, [3]),1,1);
        element(env, element0, context, "bind-attr", [], {"style": "view.paddingStyle"});
        element(env, element1, context, "bind-attr", [], {"class": ":ember-table-toggle-span view.row.isLeaf::ember-table-toggle\n    view.row.isCollapsed:ember-table-expand:ember-table-collapse"});
        element(env, element1, context, "action", ["toggleCollapse", get(env, context, "view.row")], {});
        inline(env, morph0, context, "fa-icon", ["caret-down"], {"classNames": "ember-table-toggle-icon"});
        content(env, morph1, context, "view.cellContent");
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/financial-table/financial-table', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        inline(env, morph0, context, "financial-table", [], {"data": get(env, context, "data")});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/financial', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","col-md-10 col-md-offset-2 left-border main-content-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h1");
        var el3 = dom.createTextNode("Ember Table ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("small");
        var el4 = dom.createTextNode("Financial Table");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","example-container");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("div");
        dom.setAttribute(el5,"class","ember-table-example-container ember-table-financial");
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Template");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-html");
        var el6 = dom.createTextNode("{{financial-table\n  data=data\n}}\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Controller");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import Ember from &#39;ember&#39;;\nimport Treedata from &#39;..&#x2F;models&#x2F;treedata&#39;;\n\nexport default Ember.Controller.extend({\n  data: Ember.computed(function() {\n    return Treedata;\n  })\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("components/financial-table.js");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import Ember from &#39;ember&#39;;\nimport TableComponent from &#39;ember-table&#x2F;components&#x2F;ember-table&#39;;\nimport ColumnDefinition from &#39;ember-table&#x2F;models&#x2F;column-definition&#39;;\nimport FinancialTableTreeRow from &#39;..&#x2F;views&#x2F;financial-table-tree-row&#39;;\nimport NumberFormatHelpers from &#39;..&#x2F;utils&#x2F;number-format&#39;;\n\nexport default TableComponent.extend({\n  &#x2F;&#x2F; Overriding default properties\n  layoutName: &#39;components&#x2F;ember-table&#39;,\n  numFixedColumns: 1,\n  isCollapsed: false,\n  isHeaderHeightResizable: true,\n  rowHeight: 30,\n  hasHeader: true,\n  hasFooter: true,\n  headerHeight: 70,\n\n  &#x2F;&#x2F; Custom properties\n  sortAscending: false,\n  sortColumn: null,\n\n  &#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;\n  &#x2F;&#x2F; Data conversions\n  &#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;&#x2F;\n\n  data: null,\n\n  columns: Ember.computed(function() {\n    var data = this.get(&#39;data&#39;);\n    if (!data) {\n      return;\n    }\n    var names = this.get(&#39;data.value_factors&#39;).getEach(&#39;display_name&#39;);\n    var columns = names.map(function(name, index) {\n      return ColumnDefinition.create({\n        index: index,\n        headerCellName: name,\n        headerCellView: &#39;financial-table-header-cell&#39;,\n        tableCellView: &#39;financial-table-cell&#39;,\n        getCellContent: function(row) {\n          var object = row.get(&#39;values&#39;)[this.get(&#39;index&#39;)];\n          if (object.type === &#39;money&#39;) {\n            return NumberFormatHelpers.toCurrency(object.value);\n          }\n          if (object.type === &#39;percent&#39;) {\n            return NumberFormatHelpers.toPercent(object.value);\n          }\n          return &#39;-&#39;;\n        }\n      });\n    });\n    columns.unshiftObject(this.get(&#39;groupingColumn&#39;));\n    return columns;\n  }).property(&#39;data.valueFactors.@each&#39;, &#39;groupingColumn&#39;),\n\n  groupingColumn: Ember.computed(function() {\n    var groupingFactors = this.get(&#39;data.grouping_factors&#39;);\n    var name = groupingFactors.getEach(&#39;display_name&#39;).join(&#39; ▸ &#39;);\n    return ColumnDefinition.create({\n      headerCellName: name,\n      savedWidth: 400,\n      isTreeColumn: true,\n      isSortable: false,\n      textAlign: &#39;text-align-left&#39;,\n      headerCellView: &#39;financial-table-header-tree-cell&#39;,\n      tableCellView: &#39;financial-table-tree-cell&#39;,\n      contentPath: &#39;group_value&#39;\n    });\n  }).property(&#39;data.grouping_factors.@each&#39;),\n\n  root: Ember.computed(function() {\n    var data = this.get(&#39;data&#39;);\n    if (!data) {\n      return;\n    }\n    return this.createTree(null, data.root);\n  }).property(&#39;data&#39;, &#39;sortAscending&#39;, &#39;sortColumn&#39;),\n\n  rows: Ember.computed(function() {\n    var root = this.get(&#39;root&#39;);\n    if (!root) {\n      return Ember.A();\n    }\n    var rows = this.flattenTree(null, root, Ember.A());\n    this.computeStyles(null, root);\n    var maxGroupingLevel = Math.max.apply(rows.getEach(&#39;groupingLevel&#39;));\n    rows.forEach(function(row) {\n      return row.computeRowStyle(maxGroupingLevel);\n    });\n    return rows;\n  }).property(&#39;root&#39;),\n\n  &#x2F;&#x2F; OPTIMIZATION HACK\n  bodyContent: Ember.computed(function() {\n    var rows = this.get(&#39;rows&#39;);\n    if (!rows) {\n      return Ember.A();\n    }\n    rows = rows.slice(1, rows.get(&#39;length&#39;));\n    return rows.filterProperty(&#39;isShowing&#39;);\n  }).property(&#39;rows&#39;),\n\n  footerContent: Ember.computed(function() {\n    var rows = this.get(&#39;rows&#39;);\n    if (!rows) {\n      return Ember.A();\n    }\n    return rows.slice(0, 1);\n  }).property(&#39;rows&#39;),\n\n  orderBy: function(item1, item2) {\n    var sortColumn = this.get(&#39;sortColumn&#39;);\n    var sortAscending = this.get(&#39;sortAscending&#39;);\n    if (!sortColumn) {\n      return 1;\n    }\n    var value1 = sortColumn.getCellContent(item1.get(&#39;content&#39;));\n    var value2 = sortColumn.getCellContent(item2.get(&#39;content&#39;));\n    var result = Ember.compare(value1, value2);\n    if (sortAscending) {\n      return result;\n    } else {\n      return -result;\n    }\n  },\n\n  createTree: function(parent, node) {\n    var row = FinancialTableTreeRow.create({ parentController: this });\n    &#x2F;&#x2F; TODO(azirbel): better map function and _this use\n    var children = (node.children || []).map((function(_this) {\n      return function(child) {\n        return _this.createTree(row, child);\n      };\n    })(this));\n    &#x2F;&#x2F; TODO(Peter): Hack... only collapse table if it should collapseByDefault\n    &#x2F;&#x2F; and it is not the root. Currently the total row is the root, and if it\n    &#x2F;&#x2F; is collapse, it causes nothing to show in the table and there is no way\n    &#x2F;&#x2F; to get expand it.\n    row.setProperties({\n      isRoot: !parent,\n      isLeaf: Ember.isEmpty(children),\n      content: node,\n      parent: parent,\n      children: children,\n      groupName: node.group_name,\n      isCollapsed: false\n    });\n    return row;\n  },\n\n  &#x2F;&#x2F; TODO(azirbel): Don&#39;t use the word &#39;parent&#39;\n  flattenTree: function(parent, node, rows) {\n    rows.pushObject(node);\n    (node.children || []).forEach((function(_this) {\n      return function(child) {\n        return _this.flattenTree(node, child, rows);\n      };\n    })(this));\n    return rows;\n  },\n\n  computeStyles: function(parent, node) {\n    node.computeStyles(parent);\n    node.get(&#39;children&#39;).forEach((function(_this) {\n      return function(child) {\n        _this.computeStyles(node, child);\n      };\n    })(this));\n  },\n\n  actions: {\n    toggleTableCollapse: function() {\n      var isCollapsed = this.toggleProperty(&#39;isCollapsed&#39;);\n      var children = this.get(&#39;root.children&#39;);\n      if (!(children &amp;&amp; children.get(&#39;length&#39;) &gt; 0)) {\n        return;\n      }\n      children.forEach(function(child) {\n        return child.recursiveCollapse(isCollapsed);\n      });\n      return this.notifyPropertyChange(&#39;rows&#39;);\n    },\n\n    toggleCollapse: function(row) {\n      row.toggleProperty(&#39;isCollapsed&#39;);\n      Ember.run.next(this, function() {\n        this.notifyPropertyChange(&#39;rows&#39;);\n      });\n    }\n  },\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("views/financial-table-cell.js");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import TableCell from &#39;ember-table&#x2F;views&#x2F;table-cell&#39;;\n\nexport default TableCell.extend({\n  templateName: &#39;financial-table&#x2F;financial-table-cell&#39;\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    \n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("templates/financial-table/financial-table-cell.hbs");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-html");
        var el6 = dom.createTextNode("&lt;div class=&quot;ember-table-cell-container&quot;&gt;\n  &lt;span class=&quot;ember-table-content&quot;&gt;\n    {{view.cellContent}}\n  &lt;&#x2F;span&gt;\n&lt;&#x2F;div&gt;");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("views/financial-table-header-cell.js");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import HeaderCell from &#39;ember-table&#x2F;views&#x2F;header-cell&#39;;\n\nexport default HeaderCell.extend({\n  templateName: &#39;financial-table&#x2F;financial-table-header-cell&#39;\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("templates/financial-table/financial-table-tree-cell.hbs");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-html");
        var el6 = dom.createTextNode("&lt;div class=&quot;ember-table-cell-container&quot; {{bind-attr style=&quot;view.paddingStyle&quot;}}&gt;\n  &lt;span {{bind-attr class=&quot;:ember-table-toggle-span view.row.isLeaf::ember-table-toggle\n    view.row.isCollapsed:ember-table-expand:ember-table-collapse&quot;}}\n    {{action &#39;toggleCollapse&#39; view.row}}&gt;\n    {{fa-icon &quot;caret-down&quot; classNames=&quot;ember-table-toggle-icon&quot;}}\n  &lt;&#x2F;span&gt;\n  &lt;span class=&quot;ember-table-content&quot;&gt;\n    {{view.cellContent}}\n  &lt;&#x2F;span&gt;\n&lt;&#x2F;div&gt;\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("views/financial-table-header-tree-cell.js");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import HeaderCell from &#39;ember-table&#x2F;views&#x2F;header-cell&#39;;\n\nexport default HeaderCell.extend({\n  templateName: &#39;financial-table&#x2F;financial-table-header-tree-cell&#39;,\n  classNames:   &#39;ember-table-table-header-tree-cell&#39;\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("templates/financial-table/financial-table-header-cell.hbs");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-html");
        var el6 = dom.createTextNode("&lt;div class=&quot;ember-table-cell-container&quot;&gt;\n  &lt;div class=&quot;ember-table-header-content-container&quot;&gt;\n    &lt;span class=&quot;ember-table-content&quot;&gt;\n      {{view.content.headerCellName}}\n    &lt;&#x2F;span&gt;\n  &lt;&#x2F;div&gt;\n&lt;&#x2F;div&gt;");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("views/financial-table-tree-cell.js");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import Ember from &#39;ember&#39;;\nimport TableCell from &#39;ember-table&#x2F;views&#x2F;table-cell&#39;;\n\nexport default TableCell.extend({\n  templateName: &#39;financial-table&#x2F;financial-table-tree-cell&#39;,\n  classNames: &#39;ember-table-table-tree-cell&#39;,\n\n  paddingStyle: Ember.computed(function() {\n    return &#39;padding-left:&#39; + (this.get(&#39;row.indentation&#39;)) + &#39;px;&#39;;\n  }).property(&#39;row.indentation&#39;)\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("templates/financial-table/financial-table-header-tree-cell.hbs");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-html");
        var el6 = dom.createTextNode("&lt;div class=&quot;ember-table-cell-container&quot;&gt;\n  &lt;span {{bind-attr class=&quot;:ember-table-toggle-span :ember-table-toggle\n      isCollapsed:ember-table-expand:ember-table-collapse&quot;}}\n      {{action &#39;toggleTableCollapse&#39;}}&gt;\n    {{fa-icon &quot;caret-down&quot; classNames=&quot;ember-table-toggle-icon&quot;}}\n  &lt;&#x2F;span&gt;\n  &lt;div class=&quot;ember-table-header-content-container&quot;&gt;\n    &lt;span class=&quot;ember-table-content&quot;&gt;\n      {{view.column.headerCellName}}\n    &lt;&#x2F;span&gt;\n  &lt;&#x2F;div&gt;\n&lt;&#x2F;div&gt;\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("views/financial-table-tree-row.js");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import Row from &#39;ember-table&#x2F;controllers&#x2F;row&#39;;\n\nexport default Row.extend({\n  content: null,\n  children: null,\n  parent: null,\n  isRoot: false,\n  isLeaf: false,\n  isCollapsed: false,\n  isShowing: true,\n  indentationSpacing: 20,\n  groupName: null,\n\n  computeStyles: function(parent) {\n    var groupingLevel, indentType, indentation, isShowing, pGroupingLevel, spacing;\n    groupingLevel = 0;\n    indentation = 0;\n    isShowing = true;\n    if (parent) {\n      isShowing = parent.get(&#39;isShowing&#39;) &amp;&amp; !parent.get(&#39;isCollapsed&#39;);\n      pGroupingLevel = parent.get(&#39;groupingLevel&#39;);\n      groupingLevel = pGroupingLevel;\n      if (parent.get(&#39;groupName&#39;) !== this.get(&#39;groupName&#39;)) {\n        groupingLevel += 1;\n      }\n      indentType = groupingLevel === pGroupingLevel ? &#39;half&#39; : &#39;full&#39;;\n      spacing = this.get(&#39;indentationSpacing&#39;);\n      if (!parent.get(&#39;isRoot&#39;)) {\n        indentation = parent.get(&#39;indentation&#39;);\n        indentation += (indentType === &#39;half&#39; ? spacing &#x2F; 2 : spacing);\n      }\n    }\n    this.set(&#39;groupingLevel&#39;, groupingLevel);\n    this.set(&#39;indentation&#39;, indentation);\n    this.set(&#39;isShowing&#39;, isShowing);\n  },\n\n  computeRowStyle: function(maxLevels) {\n    var level;\n    level = this.getFormattingLevel(this.get(&#39;groupingLevel&#39;), maxLevels);\n    this.set(&#39;rowStyle&#39;, &#39;ember-table-row-style-&#39; + level);\n  },\n\n  recursiveCollapse: function(isCollapsed) {\n    this.set(&#39;isCollapsed&#39;, isCollapsed);\n    this.get(&#39;children&#39;).forEach(function(child) {\n      child.recursiveCollapse(isCollapsed);\n    });\n  },\n\n  getFormattingLevel: function(level, maxLevels) {\n    switch (maxLevels) {\n      case 1:\n        return 5;\n      case 2:\n        if (level === 1) {\n          return 2;\n        }\n        return 5;\n      case 3:\n        if (level === 1) {\n          return 1;\n        }\n        if (level === 2) {\n          return 3;\n        }\n        return 5;\n      case 4:\n        if (level === 1) {\n          return 1;\n        }\n        if (level === 2) {\n          return 2;\n        }\n        if (level === 4) {\n          return 4;\n        }\n        return 5;\n      case 5:\n        return level;\n      default:\n        if (level === maxLevels) {\n          return 5;\n        }\n        return Math.min(level, 4);\n    }\n  }\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0, 3, 1, 1, 1]),1,1);
        inline(env, morph0, context, "partial", ["financial-table/financial-table"], {});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/footer-table-container', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
          inline(env, morph0, context, "view", ["table-block"], {"classNames": "ember-table-left-table-block", "content": get(env, context, "footerContent"), "columns": get(env, context, "fixedColumns"), "width": get(env, context, "_fixedBlockWidth"), "height": get(env, context, "footerHeight")});
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","ember-table-table-fixed-wrapper");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0]);
        var morph0 = dom.createMorphAt(element0,1,1);
        var morph1 = dom.createMorphAt(element0,3,3);
        block(env, morph0, context, "if", [get(env, context, "numFixedColumns")], {}, child0, null);
        inline(env, morph1, context, "view", ["table-block"], {"classNames": "ember-table-right-table-block", "content": get(env, context, "footerContent"), "columns": get(env, context, "tableColumns"), "scrollLeft": get(env, context, "_tableScrollLeft"), "width": get(env, context, "_tableBlockWidth"), "height": get(env, context, "footerHeight")});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/footer', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Overview & Getting Started");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("API & Documentation");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child2 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Migration Guides");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child3 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Community Examples");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child4 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Hello World table");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child5 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("AJAX cells");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child6 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Bar cells");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child7 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Dynamic bar cells");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child8 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Tree & financial table");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child9 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Editable cells");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child10 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Sparkline cells");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child11 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Horizon cells");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child12 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Configurable columns");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child13 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("License");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","footer");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","container");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","row");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","col-md-3");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("ul");
        dom.setAttribute(el5,"class","list-unstyled");
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createElement("h6");
        var el8 = dom.createTextNode("Ember Table");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createComment("");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createComment("");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createComment("");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createComment("");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","col-md-3");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("ul");
        dom.setAttribute(el5,"class","list-unstyled");
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createElement("h6");
        var el8 = dom.createTextNode("Examples");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createComment("");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createComment("");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createComment("");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createComment("");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createComment("");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createComment("");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createComment("");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createComment("");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createComment("");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","col-md-3");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("ul");
        dom.setAttribute(el5,"class","list-unstyled");
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createElement("h6");
        var el8 = dom.createTextNode("Addepar Open Source");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createElement("a");
        dom.setAttribute(el7,"target","_BLANK");
        dom.setAttribute(el7,"href","http://addepar.github.io/");
        var el8 = dom.createTextNode("Home");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createComment("");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","col-md-3");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("ul");
        dom.setAttribute(el5,"class","list-unstyled");
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createElement("h6");
        var el8 = dom.createTextNode("About Addepar");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createElement("a");
        dom.setAttribute(el7,"target","_BLANK");
        dom.setAttribute(el7,"href","http://www.addepar.com");
        var el8 = dom.createTextNode("www.addepar.com");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("li");
        var el7 = dom.createTextNode("\n            ");
        dom.appendChild(el6, el7);
        var el7 = dom.createElement("address");
        var el8 = dom.createTextNode("\n              ");
        dom.appendChild(el7, el8);
        var el8 = dom.createElement("br");
        dom.appendChild(el7, el8);
        var el8 = dom.createTextNode("\n              ");
        dom.appendChild(el7, el8);
        var el8 = dom.createElement("a");
        dom.setAttribute(el8,"target","_BLANK");
        dom.setAttribute(el8,"href","http://goo.gl/maps/446ui");
        var el9 = dom.createElement("strong");
        var el10 = dom.createTextNode("Addepar HQ");
        dom.appendChild(el9, el10);
        dom.appendChild(el8, el9);
        var el9 = dom.createElement("br");
        dom.appendChild(el8, el9);
        var el9 = dom.createTextNode("\n              1215 Terra Bella Ave");
        dom.appendChild(el8, el9);
        var el9 = dom.createElement("br");
        dom.appendChild(el8, el9);
        var el9 = dom.createTextNode("\n              Mountain View, CA 94043");
        dom.appendChild(el8, el9);
        dom.appendChild(el7, el8);
        var el8 = dom.createElement("br");
        dom.appendChild(el7, el8);
        var el8 = dom.createElement("br");
        dom.appendChild(el7, el8);
        var el8 = dom.createTextNode("\n\n              ");
        dom.appendChild(el7, el8);
        var el8 = dom.createElement("a");
        dom.setAttribute(el8,"target","_BLANK");
        dom.setAttribute(el8,"href","http://goo.gl/maps/xEiCM");
        var el9 = dom.createElement("strong");
        var el10 = dom.createTextNode("Addepar NY");
        dom.appendChild(el9, el10);
        dom.appendChild(el8, el9);
        var el9 = dom.createElement("br");
        dom.appendChild(el8, el9);
        var el9 = dom.createTextNode("\n              335 Madison Ave Suite 880");
        dom.appendChild(el8, el9);
        var el9 = dom.createElement("br");
        dom.appendChild(el8, el9);
        var el9 = dom.createTextNode("\n              New York, NY 10017");
        dom.appendChild(el8, el9);
        dom.appendChild(el7, el8);
        var el8 = dom.createElement("br");
        dom.appendChild(el7, el8);
        var el8 = dom.createTextNode("\n            ");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n          ");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","row");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","col-md-12 center-align");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("© 2013 Addepar, Inc.");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0, 1, 1]);
        var element1 = dom.childAt(element0, [1, 1]);
        var element2 = dom.childAt(element0, [3, 1]);
        var morph0 = dom.createMorphAt(dom.childAt(element1, [3]),0,0);
        var morph1 = dom.createMorphAt(dom.childAt(element1, [5]),0,0);
        var morph2 = dom.createMorphAt(dom.childAt(element1, [7]),0,0);
        var morph3 = dom.createMorphAt(dom.childAt(element1, [9]),0,0);
        var morph4 = dom.createMorphAt(dom.childAt(element2, [3]),0,0);
        var morph5 = dom.createMorphAt(dom.childAt(element2, [5]),0,0);
        var morph6 = dom.createMorphAt(dom.childAt(element2, [7]),0,0);
        var morph7 = dom.createMorphAt(dom.childAt(element2, [9]),0,0);
        var morph8 = dom.createMorphAt(dom.childAt(element2, [11]),0,0);
        var morph9 = dom.createMorphAt(dom.childAt(element2, [13]),0,0);
        var morph10 = dom.createMorphAt(dom.childAt(element2, [15]),0,0);
        var morph11 = dom.createMorphAt(dom.childAt(element2, [17]),0,0);
        var morph12 = dom.createMorphAt(dom.childAt(element2, [19]),0,0);
        var morph13 = dom.createMorphAt(dom.childAt(element0, [5, 1, 5]),0,0);
        block(env, morph0, context, "link-to", ["overview"], {}, child0, null);
        block(env, morph1, context, "link-to", ["documentation"], {}, child1, null);
        block(env, morph2, context, "link-to", ["migration-guides"], {}, child2, null);
        block(env, morph3, context, "link-to", ["community-examples"], {}, child3, null);
        block(env, morph4, context, "link-to", ["simple"], {}, child4, null);
        block(env, morph5, context, "link-to", ["ajax"], {}, child5, null);
        block(env, morph6, context, "link-to", ["bars"], {}, child6, null);
        block(env, morph7, context, "link-to", ["dynamic-bars"], {}, child7, null);
        block(env, morph8, context, "link-to", ["financial"], {}, child8, null);
        block(env, morph9, context, "link-to", ["editable"], {}, child9, null);
        block(env, morph10, context, "link-to", ["sparkline"], {}, child10, null);
        block(env, morph11, context, "link-to", ["horizon"], {}, child11, null);
        block(env, morph12, context, "link-to", ["configurable-columns"], {}, child12, null);
        block(env, morph13, context, "link-to", ["license"], {}, child13, null);
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/header-cell', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","ember-table-content-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        dom.setAttribute(el2,"class","ember-table-content");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, element = hooks.element, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0]);
        var morph0 = dom.createMorphAt(dom.childAt(element0, [1]),1,1);
        element(env, element0, context, "action", ["sortByColumn", get(env, context, "view.content")], {});
        content(env, morph0, context, "view.content.headerCellName");
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/header-row', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        inline(env, morph0, context, "view", ["multi-item-collection"], {"content": get(env, context, "view.content"), "itemViewClassField": "headerCellViewClass", "width": get(env, context, "controller._tableColumnsWidth")});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/header-table-container', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createComment("");
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          var morph0 = dom.createMorphAt(fragment,1,1,contextualElement);
          inline(env, morph0, context, "view", ["header-block"], {"classNames": "ember-table-left-table-block", "columns": get(env, context, "fixedColumns"), "width": get(env, context, "_fixedBlockWidth"), "height": get(env, context, "headerHeight")});
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","ember-table-table-fixed-wrapper");
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, block = hooks.block, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0]);
        var morph0 = dom.createMorphAt(element0,1,1);
        var morph1 = dom.createMorphAt(element0,3,3);
        block(env, morph0, context, "if", [get(env, context, "controller.numFixedColumns")], {}, child0, null);
        inline(env, morph1, context, "view", ["header-block"], {"classNames": "ember-table-right-table-block", "columns": get(env, context, "tableColumns"), "scrollLeft": get(env, context, "_tableScrollLeft"), "width": get(env, context, "_tableBlockWidth"), "height": get(env, context, "headerHeight")});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/horizon-table/horizon-table', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        inline(env, morph0, context, "ember-table", [], {"hasHeader": true, "hasFooter": false, "numFixedColumns": 0, "rowHeight": 30, "columns": get(env, context, "tableColumns"), "content": get(env, context, "tableContent")});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/horizon', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","col-md-10 col-md-offset-2 left-border main-content-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h1");
        var el3 = dom.createTextNode("Ember Table ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("small");
        var el4 = dom.createTextNode("Horizon");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","example-container");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("div");
        dom.setAttribute(el5,"class","ember-table-example-container");
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Template");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-html");
        var el6 = dom.createTextNode("{{ember-table\n  hasHeader=true\n  hasFooter=false\n  numFixedColumns=0\n  rowHeight=30\n  columns=tableColumns\n  content=tableContent\n}}\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Controller");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import Ember from &#39;ember&#39;;\nimport ColumnDefinition from &#39;ember-table&#x2F;models&#x2F;column-definition&#39;;\n\nexport default Ember.Controller.extend({\n  tableColumns: Ember.computed(function() {\n    var name = ColumnDefinition.create({\n      savedWidth: 100,\n      headerCellName: &#39;Name&#39;,\n      getCellContent: function(row) {\n        return &#39;Horizon &#39; + row.get(&#39;name&#39;);\n      }\n    });\n    var horizon = ColumnDefinition.create({\n      savedWidth: 600,\n      headerCellName: &#39;Horizon&#39;,\n      tableCellViewClass: &#39;horizon-table-cell&#39;,\n      getCellContent: Ember.K\n    });\n    return [name, horizon];\n  }),\n\n  tableContent: Ember.computed(function() {\n    var normal = d3.random.normal(1.5, 3);\n    var data;\n    var content = [];\n    for (var i = 0; i &lt; 100; i++) {\n      data = [];\n      for (var j = 0; j &lt; 100; j++) {\n        data.push([j, normal()]);\n      }\n      content.pushObject({\n        name: i,\n        data: data\n      });\n    }\n    return content;\n  })\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("views/horizon-table-cell.js");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import Ember from &#39;ember&#39;;\nimport TableCell from &#39;ember-table&#x2F;views&#x2F;table-cell&#39;;\nimport d3HorizonUtils from &#39;..&#x2F;utils&#x2F;horizon&#39;;\n\nexport default TableCell.extend({\n  templateName: &#39;empty-cell&#39;,\n  heightBinding: &#39;controller.rowHeight&#39;,\n\n  horizonContent: Ember.computed(function() {\n    var normal = d3.random.normal(1.5, 3);\n    var content = [];\n    for (var i = 0; i &lt; 100; i++) {\n      content.pushObject([i, normal()]);\n    }\n    return content;\n  }).property(),\n\n  onWidthDidChange: Ember.observer(function() {\n    this.$(&#39;svg&#39;).remove();\n    this.renderD3View();\n  }, &#39;width&#39;),\n\n  didInsertElement: function() {\n    this.onWidthDidChange();\n    &#x2F;&#x2F; TODO(azirbel): Add _this.super()\n  },\n\n  renderD3View: function() {\n    var chart, data, height, svg, width;\n    width = this.get(&#39;width&#39;);\n    height = this.get(&#39;height&#39;);\n    data = this.get(&#39;horizonContent&#39;);\n    chart = d3HorizonUtils.d3Horizon().width(width).height(height).bands(2).mode(&#39;mirror&#39;).interpolate(&#39;basis&#39;);\n    svg = d3.select(&#39;#&#39; + this.get(&#39;elementId&#39;)).append(&#39;svg&#39;).attr(&#39;width&#39;, width).attr(&#39;height&#39;, height);\n    svg.data([data]).call(chart);\n  }\n});\n\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0, 3, 1, 1, 1]),1,1);
        inline(env, morph0, context, "partial", ["horizon-table/horizon-table"], {});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/license', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","section");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","container main-content-container");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","row");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","col-md-6 col-md-offset-3 section-title");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("h1");
        var el6 = dom.createTextNode("Code & Documentation Licensing");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","col-md-6 col-md-offset-3");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("The majority of open source software exclusively developed by Addepar is licensed under the liberal terms of the Apache License, Version 2.0. The documentation is generally available under the Creative Commons Attribution 3.0 Unported License. In the end, you are free to use, modify and distribute any documentation, source code or examples within our open source projects as long as you adhere to the licensing conditions present within the projects.");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("Also note that our engineers like to hack on their own open source projects in their free time. For code provided by our engineers outside of our official repositories on GitHub, Addepar does not grant any type of license, whether express or implied, to such code.");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n     ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/migration-guides', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("configurable column demo.");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("here");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","col-md-10 col-md-offset-2 left-border main-content-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h1");
        var el3 = dom.createTextNode("Migration Guides");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-9");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h2");
        var el5 = dom.createTextNode("Migrating to version 0.4.0");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("\n        Version 0.4.0 contains major changes to column resizing.\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("\n        In version 0.2, setting the table's ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("code");
        var el6 = dom.createTextNode("forceFillColumns");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        property and configuring each column's ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("code");
        var el6 = dom.createTextNode("canAutoResize");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        property let you configure the table to scale automatically when\n        rendered into containers of different sizes.\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("\n        In version 0.4, the table-wide ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("code");
        var el6 = dom.createTextNode("forceFillColumns");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(" setting\n        has been removed and each column defines its own resize behavior.  Use\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("code");
        var el6 = dom.createTextNode("isResizable");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(" to set whether the column can be resized at\n        all (manually or automatically), ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("code");
        var el6 = dom.createTextNode("canAutoResize");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(" to set\n        whether the column will attempt to scale its width to different table\n        sizes, and ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("code");
        var el6 = dom.createTextNode("savedWidth");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(" to set the column's initial width or\n        persist its width once resized.\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("\n        It was previously possible to extend Ember Table so that it would\n        behave in a \"fluid\" way, meaning that resizing one column steals\n        width from its neighboring column. This is now supported in Ember Table\n        out of the box: just set ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("code");
        var el6 = dom.createTextNode("columnMode=\"fluid\"");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(".\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("\n        To get a sense for the new column resizing changes, check out the\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createComment("");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("API Changes");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("ul");
        dom.setAttribute(el4,"class","styled");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("Removed: ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("EmberTableComponent.forceFillColumns");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("Removed: ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("ColumnDefinition.columnWidth");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("Removed: ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("ColumnDefinition.defaultColumnWidth");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("Added: ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("EmberTableComponent.columnMode");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("Added: ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("ColumnDefinition.savedWidth");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Upgrade steps");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("ol");
        dom.setAttribute(el4,"class","styled styled-spacious");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("\n          Replace ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("columnWidth");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" and\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("defaultColumnWidth");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" with ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("savedWidth");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(". This\n          will set the column's initial width, and will change if the column is\n          manually resized. If you want to persist changes to column sizes,\n          simply bind to and persist ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("savedWidth");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(".\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("\n          Do not use ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("forceFillColumns");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" as it no longer has any\n          effect. Columns will fill as before if their\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("canAutoResize");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" property is ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("true");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(".\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("\n          Make sure your columns have ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("canAutoResize");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" set correctly.\n          In version 0.2 this defaulted to ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("true");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(", but only made a\n          difference if ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("forceFillColumns");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" was enabled. Now it\n          defaults to ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("false");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(", but if a column sets it to\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("true");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(", the force fill behavior is implicitly triggered.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h2");
        var el5 = dom.createTextNode("Migrating to version 0.3.0");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("\n        Version 0.3.0 includes major column resizing changes, but with\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("code");
        var el6 = dom.createTextNode("canAutoResize");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(" defaulting to ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("code");
        var el6 = dom.createTextNode("true");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(".  We\n        recommend skipping this version and upgrading directly to 0.4.0; see\n        the 0.4.0 migration guide.\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h2");
        var el5 = dom.createTextNode("Migrating to version 0.2.0");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("\n        A full migration step is not available for this version, but it\n        contains only minor API changes.\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("\n        Version 0.2 uses row objects to wrap content in the table. Because of\n        this, change any accesses to row data (e.g. in\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("code");
        var el6 = dom.createTextNode("getCellContent");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(") from ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("code");
        var el6 = dom.createTextNode("row['date']");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(" to\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("code");
        var el6 = dom.createTextNode("row.get('date')");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(".\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h2");
        var el5 = dom.createTextNode("Migrating from old versions to version 0.1.0");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("\n        Version 0.1.0 of Ember Table is a bit of a restructure - we’re hoping\n        that the new organization will make it simpler and easier to set up,\n        but for existing users, you’ll have to make a few changes to upgrade to\n        the new Ember Table.\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Upgrade steps");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("ol");
        dom.setAttribute(el4,"class","styled styled-spacious");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("\n          Upgrade ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("ember-table.js");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" and ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("ember-table.css");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(".\n          If you’re not on the latest version of ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("a");
        dom.setAttribute(el6,"target","_BLANK");
        dom.setAttribute(el6,"href","http://emberjs.com/");
        var el7 = dom.createTextNode("Ember.js");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(", now might be a good time to\n          upgrade that as well. This guide was written using Ember 1.0.0 and\n          Ember Table 0.1.0.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("\n          The major change is moving from separate table Views and Controllers\n          to a unified table Component. You can read up on Ember Components\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("a");
        dom.setAttribute(el6,"target","_BLANK");
        dom.setAttribute(el6,"href","http://emberjs.com/guides/components/");
        var el7 = dom.createTextNode("here");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(". So instead of\n          having lines like this:\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("div");
        dom.setAttribute(el6,"class","highlight");
        var el7 = dom.createTextNode("\n");
        dom.appendChild(el6, el7);
        var el7 = dom.createElement("pre");
        dom.setAttribute(el7,"class","prettyprint lang-js");
        var el8 = dom.createTextNode("App.MyTableController = Ember.Table.TableController.extend (...)\nApp.MyTableView = EmberTable.TableContainerView.extend (...)");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n          ");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          You’ll have everything in one place:\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("div");
        dom.setAttribute(el6,"class","highlight");
        var el7 = dom.createTextNode("\n");
        dom.appendChild(el6, el7);
        var el7 = dom.createElement("pre");
        dom.setAttribute(el7,"class","prettyprint lang-js");
        var el8 = dom.createTextNode("App.MyTableController = Ember.Controller.extend (...)");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n          ");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          For starters, just change the type of your MyTableController from the old version to the new.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("\n          Update your handlebars file. Before, it might have looked like:\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("br");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("div");
        dom.setAttribute(el6,"class","highlight");
        var el7 = dom.createTextNode("\n");
        dom.appendChild(el6, el7);
        var el7 = dom.createElement("pre");
        dom.setAttribute(el7,"class","prettyprint lang-html");
        var el8 = dom.createTextNode("{{view Ember.Table.TablesContainer …}}");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n          ");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          After the restructure, it should look like this:");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("br");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("div");
        dom.setAttribute(el6,"class","highlight");
        var el7 = dom.createTextNode("\n");
        dom.appendChild(el6, el7);
        var el7 = dom.createElement("pre");
        dom.setAttribute(el7,"class","prettyprint lang-html");
        var el8 = dom.createTextNode("{{table-component …}}");
        dom.appendChild(el7, el8);
        dom.appendChild(el6, el7);
        var el7 = dom.createTextNode("\n          ");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("\n          While you’re modifying that handlebars file, you may want to make\n          sure it looks like the structure of the new Ember Table examples. You\n          can see one ");
        dom.appendChild(el5, el6);
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(". In\n          particular, you might get errors if you don’t properly bind your\n          columns and content of the table, using ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("columns=");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          and ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("content=");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(".\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("br");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("br");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          Both of these settings refer to variables in the corresponding\n          controller (which here should be ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("MyTableController");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("), such that if you\n          set ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("columns=exampleVariable");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(", then the columns will be bound\n          to ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("exampleVariable");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" in the controller. This gives you control over\n          the look and content of the table.\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("br");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("br");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          Before, you may have had\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("controller=");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" here. You don’t need this any more: the\n          controller being used with this template will be used for the table\n          too, by default.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("\n          Move any properties you had defined in your\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("TableContainerView");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" (if\n          you had one) into the controller. See the examples for more\n          information on how table properties should be set now.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Troubleshooting");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("ul");
        dom.setAttribute(el4,"class","styled styled-spacious");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("\n          If you were using old Ember Table objects like the\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("RowArrayProxy");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(",\n          take another look and consider whether you really need it. During my\n          migration I was able to remove it by changing the\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("contentBinding=");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          in my handlebars file to a more appropriate variable for content.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("\n          If you are having errors with template names not being found, it\n          may be due to a change with inferring names. For me, my old template\n          names used hyphens, and changing them to underscores automatically\n          connected them to the rest of my application.\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0, 3, 1]);
        var morph0 = dom.createMorphAt(dom.childAt(element0, [11]),1,1);
        var morph1 = dom.createMorphAt(dom.childAt(element0, [37, 7]),1,1);
        block(env, morph0, context, "link-to", ["configurable-columns"], {}, child0, null);
        block(env, morph1, context, "link-to", ["simple"], {}, child1, null);
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/navigation', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("nav");
        dom.setAttribute(el1,"class","navbar navbar-transparent addepar-navbar");
        dom.setAttribute(el1,"role","navigation");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","navbar-header");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("button");
        dom.setAttribute(el3,"type","button");
        dom.setAttribute(el3,"class","navbar-toggle");
        dom.setAttribute(el3,"data-toggle","collapse");
        dom.setAttribute(el3,"data-target",".navbar-ex1-collapse");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("span");
        dom.setAttribute(el4,"class","sr-only");
        var el5 = dom.createTextNode("Toggle navigation");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("span");
        dom.setAttribute(el4,"class","icon-bar");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("span");
        dom.setAttribute(el4,"class","icon-bar");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("span");
        dom.setAttribute(el4,"class","icon-bar");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("a");
        dom.setAttribute(el3,"class","navbar-brand");
        dom.setAttribute(el3,"href","http://addepar.github.io/");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("img");
        dom.setAttribute(el4,"id","logo_dark");
        dom.setAttribute(el4,"class","logo");
        dom.setAttribute(el4,"src","images/addepar_logo_light.png");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("span");
        dom.setAttribute(el4,"class","navbar-title");
        var el5 = dom.createTextNode("Open Source");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","collapse navbar-collapse navbar-ex1-collapse");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("ul");
        dom.setAttribute(el3,"class","nav navbar-nav navbar-right");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("li");
        var el5 = dom.createElement("a");
        dom.setAttribute(el5,"href","#");
        var el6 = dom.createTextNode("Ember Table");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("li");
        var el5 = dom.createElement("a");
        dom.setAttribute(el5,"href","http://addepar.github.io/ember-charts");
        var el6 = dom.createTextNode("Ember Charts");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("li");
        var el5 = dom.createElement("a");
        dom.setAttribute(el5,"href","http://addepar.github.io/ember-widgets");
        var el6 = dom.createTextNode("Ember Widgets");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createComment(" /.navbar-collapse ");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/overview', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("          ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","col-md-4");
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("h4");
          var el3 = dom.createTextNode("Hello World Table");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("img");
          dom.setAttribute(el2,"class","preview-box");
          dom.setAttribute(el2,"src","images/preview_table_simple.png");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("          ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","col-md-4");
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("h4");
          var el3 = dom.createTextNode("AJAX cells");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("img");
          dom.setAttribute(el2,"class","preview-box");
          dom.setAttribute(el2,"src","images/preview_table_ajax.png");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child2 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("          ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","col-md-4");
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("h4");
          var el3 = dom.createTextNode("Bar cells");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("img");
          dom.setAttribute(el2,"class","preview-box");
          dom.setAttribute(el2,"src","images/preview_table_bars.png");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child3 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("          ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","col-md-4");
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("h4");
          var el3 = dom.createTextNode("Dynamic bar cells");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("img");
          dom.setAttribute(el2,"class","preview-box");
          dom.setAttribute(el2,"src","images/preview_table_dynamic_bars.png");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child4 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("          ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","col-md-4");
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("h4");
          var el3 = dom.createTextNode("Tree & financial table");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("img");
          dom.setAttribute(el2,"class","preview-box");
          dom.setAttribute(el2,"src","images/preview_table_financial.png");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child5 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("          ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","col-md-4");
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("h4");
          var el3 = dom.createTextNode("Editable cell");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("img");
          dom.setAttribute(el2,"class","preview-box");
          dom.setAttribute(el2,"src","images/preview_table_editable.png");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child6 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("          ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","col-md-4");
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("h4");
          var el3 = dom.createTextNode("Sparkline cell using D3.js");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("img");
          dom.setAttribute(el2,"class","preview-box");
          dom.setAttribute(el2,"src","images/preview_table_sparkline.png");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child7 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("          ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","col-md-4");
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("h4");
          var el3 = dom.createTextNode("Horizon cell using D3.js");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("img");
          dom.setAttribute(el2,"class","preview-box");
          dom.setAttribute(el2,"src","images/preview_table_horizon.png");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child8 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("          ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("div");
          dom.setAttribute(el1,"class","col-md-4");
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("h4");
          var el3 = dom.createTextNode("Configurable Column Demo");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n            ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("img");
          dom.setAttribute(el2,"class","preview-box");
          dom.setAttribute(el2,"src","images/preview_table_simple.png");
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n          ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child9 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Community Examples");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","col-md-10 col-md-offset-2 left-border main-content-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h1");
        var el5 = dom.createTextNode("Ember Table");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        dom.setAttribute(el4,"class","elevated");
        var el5 = dom.createTextNode("Ember table allows you to render very\n      large data sets by only rendering the rows that are being\n      displayed.");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("br");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("It is written as an ember component with an API that is\n      easy to understand and extend.");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","example-container");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("div");
        dom.setAttribute(el5,"class","ember-table-example-container ember-table-financial");
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-6");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Features");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("ul");
        dom.setAttribute(el4,"class","styled");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("Lazy rendering and support for millions of rows");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("Support for column resizing and reordering");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("Configurable, customizable, and extendable");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-6");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Dependencies");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("ul");
        dom.setAttribute(el4,"class","styled");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createElement("a");
        dom.setAttribute(el6,"target","_BLANK");
        dom.setAttribute(el6,"href","http://emberjs.com/");
        var el7 = dom.createTextNode("ember");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createElement("a");
        dom.setAttribute(el6,"target","_BLANK");
        dom.setAttribute(el6,"href","http://jqueryui.com/download/#!components=1110001010000000000000000000000000");
        var el7 = dom.createTextNode("\n          jquery-ui");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("br");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("small");
        var el7 = dom.createTextNode("(only core, widget, mouse, resizable, and sortable modules required)");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createElement("a");
        dom.setAttribute(el6,"target","_BLANK");
        dom.setAttribute(el6,"href","https://github.com/brandonaaron/jquery-mousewheel");
        var el7 = dom.createTextNode("jquery.mousewheel");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createElement("a");
        dom.setAttribute(el6,"target","_BLANK");
        dom.setAttribute(el6,"href","https://github.com/azirbel/antiscroll");
        var el7 = dom.createTextNode("antiscroll");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("hr");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h1");
        var el5 = dom.createTextNode("Examples");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        dom.setAttribute(el4,"class","elevated");
        var el5 = dom.createTextNode("The examples below demonstrate how you can extend and customize the table.");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","row ember-table-examples");
        var el5 = dom.createTextNode("\n");
        dom.appendChild(el4, el5);
        var el5 = dom.createComment("");
        dom.appendChild(el4, el5);
        var el5 = dom.createComment("");
        dom.appendChild(el4, el5);
        var el5 = dom.createComment("");
        dom.appendChild(el4, el5);
        var el5 = dom.createComment("");
        dom.appendChild(el4, el5);
        var el5 = dom.createComment("");
        dom.appendChild(el4, el5);
        var el5 = dom.createComment("");
        dom.appendChild(el4, el5);
        var el5 = dom.createComment("");
        dom.appendChild(el4, el5);
        var el5 = dom.createComment("");
        dom.appendChild(el4, el5);
        var el5 = dom.createComment("");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("Looking for more ways to extend ember-table? Check out the ");
        dom.appendChild(el4, el5);
        var el5 = dom.createComment("");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(".");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-6");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("hr");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h1");
        var el5 = dom.createTextNode("Getting Started");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("You will need ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("a");
        dom.setAttribute(el5,"target","_BLANK");
        dom.setAttribute(el5,"href","http://nodejs.org/");
        var el6 = dom.createTextNode("node");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(" installed as a development dependency.");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createElement("a");
        dom.setAttribute(el5,"target","_BLANK");
        dom.setAttribute(el5,"href","https://github.com/Addepar/ember-table/");
        var el6 = dom.createTextNode("Clone it from Github");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(" or ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("a");
        dom.setAttribute(el5,"target","_BLANK");
        dom.setAttribute(el5,"href","https://github.com/Addepar/ember-table/releases");
        var el6 = dom.createTextNode("download the ZIP repo");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        var el6 = dom.createElement("code");
        var el7 = dom.createTextNode("$ npm install -g grunt-cli\n$ npm install\n$ bower install\n$ ember serve");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("p");
        var el6 = dom.createTextNode("Go to your browser and navigate to ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("a");
        dom.setAttribute(el6,"target","_BLANK");
        dom.setAttribute(el6,"href","http://localhost:4200");
        var el7 = dom.createTextNode("localhost:4200");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-6");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("hr");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h1");
        var el5 = dom.createTextNode("Contributing");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("You can contribute to this project in one of two ways:");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("ul");
        dom.setAttribute(el4,"class","styled");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("Browse the ember-table ");
        dom.appendChild(el5, el6);
        var el6 = dom.createElement("a");
        dom.setAttribute(el6,"target","_BLANK");
        dom.setAttribute(el6,"href","https://github.com/Addepar/ember-table/issues?state=open");
        var el7 = dom.createTextNode("issues");
        dom.appendChild(el6, el7);
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode(" and report bugs");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("li");
        var el6 = dom.createTextNode("Clone the ember-table repo, make some changes according to our development guidelines and issue a pull-request with your changes.");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("We keep the ember-table.js code to the minimum necessary, giving users as much control as possible.");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-6");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("hr");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h1");
        var el5 = dom.createTextNode("Changelog");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("The current version is 0.9.0.");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("For the full list of changes, please see ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("a");
        dom.setAttribute(el5,"target","_BLANK");
        dom.setAttribute(el5,"href","https://github.com/Addepar/ember-table/blob/master/CHANGELOG.md");
        var el6 = dom.createTextNode("CHANGELOG.md");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(".");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-6");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("hr");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h1");
        var el5 = dom.createTextNode("Acknowledgements");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createElement("a");
        dom.setAttribute(el5,"target","_BLANK");
        dom.setAttribute(el5,"href","https://github.com/Addepar/ember-table/graphs/contributors");
        var el6 = dom.createTextNode("List of Contributors on Github");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("With lots of help from the Ember.js team");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createElement("a");
        dom.setAttribute(el5,"target","_BLANK");
        dom.setAttribute(el5,"href","https://twitter.com/ebryn");
        var el6 = dom.createTextNode("ebryn");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(", ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("a");
        dom.setAttribute(el5,"target","_BLANK");
        dom.setAttribute(el5,"href","https://twitter.com/tomdale");
        var el6 = dom.createTextNode("tomdale");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(", ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("a");
        dom.setAttribute(el5,"target","_BLANK");
        dom.setAttribute(el5,"href","https://twitter.com/wycats");
        var el6 = dom.createTextNode("wycats");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("p");
        var el5 = dom.createTextNode("The original idea for lazy rendering was inspired by Erik Bryn.");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0]);
        var element1 = dom.childAt(element0, [5, 1]);
        var element2 = dom.childAt(element1, [7]);
        var morph0 = dom.createMorphAt(dom.childAt(element0, [1, 1, 5, 1]),1,1);
        var morph1 = dom.createMorphAt(element2,1,1);
        var morph2 = dom.createMorphAt(element2,2,2);
        var morph3 = dom.createMorphAt(element2,3,3);
        var morph4 = dom.createMorphAt(element2,4,4);
        var morph5 = dom.createMorphAt(element2,5,5);
        var morph6 = dom.createMorphAt(element2,6,6);
        var morph7 = dom.createMorphAt(element2,7,7);
        var morph8 = dom.createMorphAt(element2,8,8);
        var morph9 = dom.createMorphAt(element2,9,9);
        var morph10 = dom.createMorphAt(dom.childAt(element1, [9]),1,1);
        inline(env, morph0, context, "financial-table", [], {"data": get(env, context, "data")});
        block(env, morph1, context, "link-to", ["simple"], {}, child0, null);
        block(env, morph2, context, "link-to", ["ajax"], {}, child1, null);
        block(env, morph3, context, "link-to", ["bars"], {}, child2, null);
        block(env, morph4, context, "link-to", ["dynamic-bars"], {}, child3, null);
        block(env, morph5, context, "link-to", ["financial"], {}, child4, null);
        block(env, morph6, context, "link-to", ["editable"], {}, child5, null);
        block(env, morph7, context, "link-to", ["sparkline"], {}, child6, null);
        block(env, morph8, context, "link-to", ["horizon"], {}, child7, null);
        block(env, morph9, context, "link-to", ["configurable-columns"], {}, child8, null);
        block(env, morph10, context, "link-to", ["community-examples"], {}, child9, null);
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/scroll-container', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","antiscroll-wrap");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","antiscroll-inner");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0, 1]),1,1);
        inline(env, morph0, context, "view", ["scroll-panel"], {});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/simple-table/simple-table', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        inline(env, morph0, context, "ember-table", [], {"hasFooter": false, "columns": get(env, context, "tableColumns"), "content": get(env, context, "tableContent")});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/simple', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","col-md-10 col-md-offset-2 left-border main-content-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h1");
        var el3 = dom.createTextNode("Ember Table ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("small");
        var el4 = dom.createTextNode("Simple");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","example-container");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("div");
        dom.setAttribute(el5,"class","ember-table-example-container");
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Template");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-html");
        var el6 = dom.createTextNode("{{ember-table\n  hasFooter=false\n  columns=tableColumns\n  content=tableContent\n}}\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Controller");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import Ember from &#39;ember&#39;;\nimport ColumnDefinition from &#39;ember-table&#x2F;models&#x2F;column-definition&#39;;\n\nexport default Ember.Controller.extend({\n  tableColumns: Ember.computed(function() {\n    var dateColumn = ColumnDefinition.create({\n      savedWidth: 150,\n      textAlign: &#39;text-align-left&#39;,\n      headerCellName: &#39;Date&#39;,\n      getCellContent: function(row) {\n        return row.get(&#39;date&#39;).toDateString();\n      }\n    });\n    var openColumn = ColumnDefinition.create({\n      savedWidth: 100,\n      headerCellName: &#39;Open&#39;,\n      getCellContent: function(row) {\n        return row.get(&#39;open&#39;).toFixed(2);\n      }\n    });\n    var highColumn = ColumnDefinition.create({\n      savedWidth: 100,\n      headerCellName: &#39;High&#39;,\n      getCellContent: function(row) {\n        return row.get(&#39;high&#39;).toFixed(2);\n      }\n    });\n    var lowColumn = ColumnDefinition.create({\n      savedWidth: 100,\n      headerCellName: &#39;Low&#39;,\n      getCellContent: function(row) {\n        return row.get(&#39;low&#39;).toFixed(2);\n      }\n    });\n    var closeColumn = ColumnDefinition.create({\n      savedWidth: 100,\n      headerCellName: &#39;Close&#39;,\n      getCellContent: function(row) {\n        return row.get(&#39;close&#39;).toFixed(2);\n      }\n    });\n    return [dateColumn, openColumn, highColumn, lowColumn, closeColumn];\n  }),\n\n  tableContent: Ember.computed(function() {\n    var content = [];\n    var date;\n    for (var i = 0; i &lt; 100; i++) {\n      date = new Date();\n      date.setDate(date.getDate() + i);\n      content.pushObject({\n        date: date,\n        open: Math.random() * 100 - 50,\n        high: Math.random() * 100 - 50,\n        low: Math.random() * 100 - 50,\n        close: Math.random() * 100 - 50,\n        volume: Math.random() * 1000000\n      });\n    }\n    return content;\n  })\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0, 3, 1, 1, 1]),1,1);
        inline(env, morph0, context, "partial", ["simple-table/simple-table"], {});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/sparkline-table/sparkline-table', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        inline(env, morph0, context, "ember-table", [], {"hasHeader": true, "hasFooter": false, "numFixedColumns": 1, "rowHeight": 30, "columns": get(env, context, "tableColumns"), "content": get(env, context, "tableContent")});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/sparkline', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","col-md-10 col-md-offset-2 left-border main-content-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("h1");
        var el3 = dom.createTextNode("Ember Table ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("small");
        var el4 = dom.createTextNode("Sparkline");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","row");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","example-container");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("div");
        dom.setAttribute(el5,"class","ember-table-example-container");
        var el6 = dom.createTextNode("\n          ");
        dom.appendChild(el5, el6);
        var el6 = dom.createComment("");
        dom.appendChild(el5, el6);
        var el6 = dom.createTextNode("\n        ");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Template");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-html");
        var el6 = dom.createTextNode("{{ember-table\n  hasHeader=true\n  hasFooter=false\n  numFixedColumns=1\n  rowHeight=30\n  columns=tableColumns\n  content=tableContent\n}}\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("Controller");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import Ember from &#39;ember&#39;;\nimport ColumnDefinition from &#39;ember-table&#x2F;models&#x2F;column-definition&#39;;\n\nexport default Ember.Controller.extend({\n  tableColumns: Ember.computed(function() {\n    var name = ColumnDefinition.create({\n      savedWidth: 100,\n      headerCellName: &#39;Name&#39;,\n      getCellContent: function(row) {\n        return &#39;Asset &#39; + row.get(&#39;name&#39;);\n      }\n    });\n    var open = ColumnDefinition.create({\n      savedWidth: 100,\n      headerCellName: &#39;Open&#39;,\n      getCellContent: function(row) {\n        return row.get(&#39;open&#39;).toFixed(2);\n      }\n    });\n    var spark = ColumnDefinition.create({\n      savedWidth: 200,\n      headerCellName: &#39;Sparkline&#39;,\n      tableCellViewClass: &#39;sparkline-table-cell&#39;,\n      contentPath: &#39;timeseries&#39;\n    });\n    var close = ColumnDefinition.create({\n      savedWidth: 100,\n      headerCellName: &#39;Close&#39;,\n      getCellContent: function(row) {\n        return row.get(&#39;close&#39;).toFixed(2);\n      }\n    });\n    var low = ColumnDefinition.create({\n      savedWidth: 100,\n      headerCellName: &#39;Low&#39;,\n      getCellContent: function(row) {\n        return row.get(&#39;low&#39;).toFixed(2);\n      }\n    });\n    var high = ColumnDefinition.create({\n      savedWidth: 100,\n      headerCellName: &#39;High&#39;,\n      getCellContent: function(row) {\n        return row.get(&#39;high&#39;).toFixed(2);\n      }\n    });\n    return [name, open, spark, close, low, high];\n  }),\n\n  tableContent: Ember.computed(function() {\n    var randomWalk = function(numSteps) {\n      var lastValue = 0;\n      var walk = [];\n      for (var i = 0; i &lt; numSteps; i++) {\n        lastValue = lastValue + d3.random.normal()();\n        walk.push(lastValue);\n      }\n      return walk;\n    };\n    var content = [];\n    var data;\n    for (var i = 0; i &lt; 100; i++) {\n      data = randomWalk(100);\n      content.pushObject({\n        name: i,\n        timeseries: data,\n        open: data[0],\n        close: data[99],\n        low: Math.min.apply(null, data),\n        high: Math.max.apply(null, data)\n      });\n    }\n    return content;\n  })\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("div");
        dom.setAttribute(el3,"class","col-md-12 bumper-30");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("h3");
        var el5 = dom.createTextNode("views/sparkline_table_cell.js");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("div");
        dom.setAttribute(el4,"class","highlight");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("pre");
        dom.setAttribute(el5,"class","prettyprint lang-js");
        var el6 = dom.createTextNode("import Ember from &#39;ember&#39;;\nimport TableCell from &#39;ember-table&#x2F;views&#x2F;table-cell&#39;;\n\nexport default TableCell.extend({\n  templateName: &#39;empty-cell&#39;,\n  heightBinding: &#39;controller.rowHeight&#39;,\n\n  onContentOrSizeDidChange: Ember.observer(function() {\n    this.$(&#39;svg&#39;).remove();\n    this.renderD3View();\n  }, &#39;row&#39;, &#39;width&#39;),\n\n  didInsertElement: function() {\n    this.renderD3View();\n    &#x2F;&#x2F; TODO(azirbel): Add _this.super()\n  },\n\n  renderD3View: function() {\n    var data = this.get(&#39;row.timeseries&#39;);\n    if (!data) {\n      return;\n    }\n    var h = this.get(&#39;height&#39;);\n    var w = this.get(&#39;width&#39;);\n    var p = 2;\n    var min = Math.min.apply(null, data);\n    var max = Math.max.apply(null, data);\n    var len = data.length;\n    var fill = d3.scale.category10();\n    var xscale = d3.scale.linear().domain([0, len]).range([p, w - p]);\n    var yscale = d3.scale.linear().domain([min, max]).range([h - p, p]);\n    var line = d3.svg.line().x(function(d, i) {\n      return xscale(i);\n    }).y(function(d) {\n      return yscale(d);\n    });\n    var svg = d3.select(&#39;#&#39; + (this.get(&#39;elementId&#39;))).append(&#39;svg:svg&#39;).attr(&#39;height&#39;, h).attr(&#39;width&#39;, w);\n    var g = svg.append(&#39;svg:g&#39;);\n    g.append(&#39;svg:path&#39;).attr(&#39;d&#39;, line(data)).attr(&#39;stroke&#39;, function() {\n      return fill(Math.round(Math.random()) * 10);\n    }).attr(&#39;fill&#39;, &#39;none&#39;);\n  }\n});\n");
        dom.appendChild(el5, el6);
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode("\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0, 3, 1, 1, 1]),1,1);
        inline(env, morph0, context, "partial", ["sparkline-table/sparkline-table"], {});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/sub-navigation', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    var child0 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Overview & Getting Started");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child1 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("API & Documentation");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child2 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Migration Guides");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child3 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Hello World table");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child4 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("AJAX cells");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child5 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Bar cells");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child6 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Dynamic bar cells");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child7 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Tree & financial table");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child8 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Editable cells");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child9 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Sparkline cells");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child10 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Horizon cells");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child11 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("Configurable columns");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    var child12 = (function() {
      return {
        isHTMLBars: true,
        revision: "Ember@1.12.1",
        blockParams: 0,
        cachedFragment: null,
        hasRendered: false,
        build: function build(dom) {
          var el0 = dom.createDocumentFragment();
          var el1 = dom.createTextNode("    ");
          dom.appendChild(el0, el1);
          var el1 = dom.createElement("ul");
          dom.setAttribute(el1,"class","list-unstyled project-navigation");
          var el2 = dom.createTextNode("\n      ");
          dom.appendChild(el1, el2);
          var el2 = dom.createElement("li");
          dom.setAttribute(el2,"class","sub-title");
          var el3 = dom.createTextNode("Community Examples");
          dom.appendChild(el2, el3);
          dom.appendChild(el1, el2);
          var el2 = dom.createTextNode("\n    ");
          dom.appendChild(el1, el2);
          dom.appendChild(el0, el1);
          var el1 = dom.createTextNode("\n");
          dom.appendChild(el0, el1);
          return el0;
        },
        render: function render(context, env, contextualElement) {
          var dom = env.dom;
          dom.detectNamespace(contextualElement);
          var fragment;
          if (env.useFragmentCache && dom.canClone) {
            if (this.cachedFragment === null) {
              fragment = this.build(dom);
              if (this.hasRendered) {
                this.cachedFragment = fragment;
              } else {
                this.hasRendered = true;
              }
            }
            if (this.cachedFragment) {
              fragment = dom.cloneNode(this.cachedFragment, true);
            }
          } else {
            fragment = this.build(dom);
          }
          return fragment;
        }
      };
    }());
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","col-md-2 sub-navigation-sidebar");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("ul");
        dom.setAttribute(el2,"class","list-unstyled github-navigation");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("a");
        dom.setAttribute(el4,"class","btn btn-default");
        dom.setAttribute(el4,"target","_BLANK");
        dom.setAttribute(el4,"href","https://github.com/addepar/ember-table");
        var el5 = dom.createTextNode("\n        ");
        dom.appendChild(el4, el5);
        var el5 = dom.createElement("i");
        dom.setAttribute(el5,"class","icon-github");
        dom.appendChild(el4, el5);
        var el5 = dom.createTextNode(" View on GitHub\n      ");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createTextNode("\n      ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("iframe");
        dom.setAttribute(el4,"src","http://ghbtns.com/github-btn.html?user=addepar&repo=ember-table&type=watch&count=true");
        dom.setAttribute(el4,"allowtransparency","true");
        dom.setAttribute(el4,"frameborder","0");
        dom.setAttribute(el4,"scrolling","0");
        dom.setAttribute(el4,"width","130");
        dom.setAttribute(el4,"height","30");
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n    ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("hr");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("ul");
        dom.setAttribute(el2,"class","list-unstyled project-navigation");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        dom.setAttribute(el3,"class","sub-title");
        var el4 = dom.createTextNode("Ember Table");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("hr");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("ul");
        dom.setAttribute(el2,"class","list-unstyled project-navigation");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        dom.setAttribute(el3,"class","sub-title");
        var el4 = dom.createTextNode("Examples");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("li");
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("hr");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, block = hooks.block;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0]);
        var element1 = dom.childAt(element0, [5]);
        var element2 = dom.childAt(element0, [9]);
        var morph0 = dom.createMorphAt(dom.childAt(element1, [3]),0,0);
        var morph1 = dom.createMorphAt(dom.childAt(element1, [5]),0,0);
        var morph2 = dom.createMorphAt(dom.childAt(element1, [7]),0,0);
        var morph3 = dom.createMorphAt(dom.childAt(element2, [3]),0,0);
        var morph4 = dom.createMorphAt(dom.childAt(element2, [5]),0,0);
        var morph5 = dom.createMorphAt(dom.childAt(element2, [7]),0,0);
        var morph6 = dom.createMorphAt(dom.childAt(element2, [9]),0,0);
        var morph7 = dom.createMorphAt(dom.childAt(element2, [11]),0,0);
        var morph8 = dom.createMorphAt(dom.childAt(element2, [13]),0,0);
        var morph9 = dom.createMorphAt(dom.childAt(element2, [15]),0,0);
        var morph10 = dom.createMorphAt(dom.childAt(element2, [17]),0,0);
        var morph11 = dom.createMorphAt(dom.childAt(element2, [19]),0,0);
        var morph12 = dom.createMorphAt(element0,13,13);
        block(env, morph0, context, "link-to", ["overview"], {}, child0, null);
        block(env, morph1, context, "link-to", ["documentation"], {}, child1, null);
        block(env, morph2, context, "link-to", ["migration-guides"], {}, child2, null);
        block(env, morph3, context, "link-to", ["simple"], {}, child3, null);
        block(env, morph4, context, "link-to", ["ajax"], {}, child4, null);
        block(env, morph5, context, "link-to", ["bars"], {}, child5, null);
        block(env, morph6, context, "link-to", ["dynamic-bars"], {}, child6, null);
        block(env, morph7, context, "link-to", ["financial"], {}, child7, null);
        block(env, morph8, context, "link-to", ["editable"], {}, child8, null);
        block(env, morph9, context, "link-to", ["sparkline"], {}, child9, null);
        block(env, morph10, context, "link-to", ["horizon"], {}, child10, null);
        block(env, morph11, context, "link-to", ["configurable-columns"], {}, child11, null);
        block(env, morph12, context, "link-to", ["community-examples"], {}, child12, null);
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/table-cell', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("span");
        dom.setAttribute(el1,"class","ember-table-content");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(dom.childAt(fragment, [0]),1,1);
        content(env, morph0, context, "view.cellContent");
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/table-row', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createComment("");
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, inline = hooks.inline;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var morph0 = dom.createMorphAt(fragment,0,0,contextualElement);
        dom.insertBoundary(fragment, 0);
        inline(env, morph0, context, "view", ["multi-item-collection"], {"row": get(env, context, "view.row"), "content": get(env, context, "view.columns"), "itemViewClassField": "tableCellViewClass", "width": get(env, context, "controller._tableColumnsWidth")});
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/tree_table/table_header_cell', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","ember-table-content-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        dom.setAttribute(el2,"class","ember-table-content");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, get = hooks.get, element = hooks.element, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0]);
        var morph0 = dom.createMorphAt(dom.childAt(element0, [1]),1,1);
        element(env, element0, context, "action", ["sortByColumn", get(env, context, "view.content")], {});
        content(env, morph0, context, "view.content.headerCellName");
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/tree_table/table_header_tree_cell', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("span");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("div");
        dom.setAttribute(el1,"class","ember-table-content-container");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        dom.setAttribute(el2,"class","ember-table-content");
        var el3 = dom.createTextNode("\n    ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n  ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, element = hooks.element, get = hooks.get, inline = hooks.inline, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0]);
        var element1 = dom.childAt(fragment, [2]);
        var morph0 = dom.createMorphAt(element0,1,1);
        var morph1 = dom.createMorphAt(dom.childAt(element1, [1]),1,1);
        element(env, element0, context, "bind-attr", [], {"class": ":ember-table-toggle-span view.row.isLeaf::ember-table-toggle\n    view.row.isCollapsed:ember-table-expand:ember-table-collapse"});
        element(env, element0, context, "action", ["toggleCollapse", get(env, context, "view.row")], {});
        inline(env, morph0, context, "fa-icon", ["caret-down"], {"classNames": "ember-table-toggle-icon"});
        element(env, element1, context, "action", ["sortByColumn", get(env, context, "view.column")], {});
        content(env, morph1, context, "view.column.headerCellName");
        return fragment;
      }
    };
  }()));

});
define('dummy/templates/tree_table/table_tree_cell', ['exports'], function (exports) {

  'use strict';

  exports['default'] = Ember.HTMLBars.template((function() {
    return {
      isHTMLBars: true,
      revision: "Ember@1.12.1",
      blockParams: 0,
      cachedFragment: null,
      hasRendered: false,
      build: function build(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("span");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        var el1 = dom.createElement("span");
        dom.setAttribute(el1,"class","ember-table-content");
        var el2 = dom.createTextNode("\n  ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode("\n");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        var el1 = dom.createTextNode("\n");
        dom.appendChild(el0, el1);
        return el0;
      },
      render: function render(context, env, contextualElement) {
        var dom = env.dom;
        var hooks = env.hooks, element = hooks.element, get = hooks.get, inline = hooks.inline, content = hooks.content;
        dom.detectNamespace(contextualElement);
        var fragment;
        if (env.useFragmentCache && dom.canClone) {
          if (this.cachedFragment === null) {
            fragment = this.build(dom);
            if (this.hasRendered) {
              this.cachedFragment = fragment;
            } else {
              this.hasRendered = true;
            }
          }
          if (this.cachedFragment) {
            fragment = dom.cloneNode(this.cachedFragment, true);
          }
        } else {
          fragment = this.build(dom);
        }
        var element0 = dom.childAt(fragment, [0]);
        var morph0 = dom.createMorphAt(element0,1,1);
        var morph1 = dom.createMorphAt(dom.childAt(fragment, [2]),1,1);
        element(env, element0, context, "bind-attr", [], {"class": ":ember-table-toggle-span view.row.isLeaf::ember-table-toggle\n    view.row.isCollapsed:ember-table-expand:ember-table-collapse"});
        element(env, element0, context, "action", ["toggleCollapse", get(env, context, "view.row")], {});
        inline(env, morph0, context, "fa-icon", ["caret-down"], {"classNames": "ember-table-toggle-icon"});
        content(env, morph1, context, "view.cellContent");
        return fragment;
      }
    };
  }()));

});
define('dummy/tests/app.jshint', function () {

  'use strict';

  module('JSHint - .');
  test('app.js should pass jshint', function() { 
    ok(true, 'app.js should pass jshint.'); 
  });

});
define('dummy/tests/components/configurable-table.jshint', function () {

  'use strict';

  module('JSHint - components');
  test('components/configurable-table.js should pass jshint', function() { 
    ok(true, 'components/configurable-table.js should pass jshint.'); 
  });

});
define('dummy/tests/components/financial-table.jshint', function () {

  'use strict';

  module('JSHint - components');
  test('components/financial-table.js should pass jshint', function() { 
    ok(true, 'components/financial-table.js should pass jshint.'); 
  });

});
define('dummy/tests/controllers/ajax.jshint', function () {

  'use strict';

  module('JSHint - controllers');
  test('controllers/ajax.js should pass jshint', function() { 
    ok(true, 'controllers/ajax.js should pass jshint.'); 
  });

});
define('dummy/tests/controllers/bars.jshint', function () {

  'use strict';

  module('JSHint - controllers');
  test('controllers/bars.js should pass jshint', function() { 
    ok(true, 'controllers/bars.js should pass jshint.'); 
  });

});
define('dummy/tests/controllers/configurable-columns.jshint', function () {

  'use strict';

  module('JSHint - controllers');
  test('controllers/configurable-columns.js should pass jshint', function() { 
    ok(true, 'controllers/configurable-columns.js should pass jshint.'); 
  });

});
define('dummy/tests/controllers/dynamic-bars.jshint', function () {

  'use strict';

  module('JSHint - controllers');
  test('controllers/dynamic-bars.js should pass jshint', function() { 
    ok(true, 'controllers/dynamic-bars.js should pass jshint.'); 
  });

});
define('dummy/tests/controllers/editable.jshint', function () {

  'use strict';

  module('JSHint - controllers');
  test('controllers/editable.js should pass jshint', function() { 
    ok(true, 'controllers/editable.js should pass jshint.'); 
  });

});
define('dummy/tests/controllers/financial.jshint', function () {

  'use strict';

  module('JSHint - controllers');
  test('controllers/financial.js should pass jshint', function() { 
    ok(true, 'controllers/financial.js should pass jshint.'); 
  });

});
define('dummy/tests/controllers/horizon.jshint', function () {

  'use strict';

  module('JSHint - controllers');
  test('controllers/horizon.js should pass jshint', function() { 
    ok(true, 'controllers/horizon.js should pass jshint.'); 
  });

});
define('dummy/tests/controllers/overview.jshint', function () {

  'use strict';

  module('JSHint - controllers');
  test('controllers/overview.js should pass jshint', function() { 
    ok(true, 'controllers/overview.js should pass jshint.'); 
  });

});
define('dummy/tests/controllers/simple.jshint', function () {

  'use strict';

  module('JSHint - controllers');
  test('controllers/simple.js should pass jshint', function() { 
    ok(true, 'controllers/simple.js should pass jshint.'); 
  });

});
define('dummy/tests/controllers/sparkline.jshint', function () {

  'use strict';

  module('JSHint - controllers');
  test('controllers/sparkline.js should pass jshint', function() { 
    ok(true, 'controllers/sparkline.js should pass jshint.'); 
  });

});
define('dummy/tests/helpers/resolver', ['exports', 'ember/resolver', 'dummy/config/environment'], function (exports, Resolver, config) {

  'use strict';

  var resolver = Resolver['default'].create();

  resolver.namespace = {
    modulePrefix: config['default'].modulePrefix,
    podModulePrefix: config['default'].podModulePrefix
  };

  exports['default'] = resolver;

});
define('dummy/tests/helpers/resolver.jshint', function () {

  'use strict';

  module('JSHint - helpers');
  test('helpers/resolver.js should pass jshint', function() { 
    ok(true, 'helpers/resolver.js should pass jshint.'); 
  });

});
define('dummy/tests/helpers/start-app', ['exports', 'ember', 'dummy/app', 'dummy/router', 'dummy/config/environment'], function (exports, Ember, Application, Router, config) {

  'use strict';



  exports['default'] = startApp;
  function startApp(attrs) {
    var application;

    var attributes = Ember['default'].merge({}, config['default'].APP);
    attributes = Ember['default'].merge(attributes, attrs); // use defaults, but you can override;

    Ember['default'].run(function () {
      application = Application['default'].create(attributes);
      application.setupForTesting();
      application.injectTestHelpers();
    });

    return application;
  }

});
define('dummy/tests/helpers/start-app.jshint', function () {

  'use strict';

  module('JSHint - helpers');
  test('helpers/start-app.js should pass jshint', function() { 
    ok(true, 'helpers/start-app.js should pass jshint.'); 
  });

});
define('dummy/tests/models/treedata.jshint', function () {

  'use strict';

  module('JSHint - models');
  test('models/treedata.js should pass jshint', function() { 
    ok(true, 'models/treedata.js should pass jshint.'); 
  });

});
define('dummy/tests/router.jshint', function () {

  'use strict';

  module('JSHint - .');
  test('router.js should pass jshint', function() { 
    ok(true, 'router.js should pass jshint.'); 
  });

});
define('dummy/tests/routes/index.jshint', function () {

  'use strict';

  module('JSHint - routes');
  test('routes/index.js should pass jshint', function() { 
    ok(true, 'routes/index.js should pass jshint.'); 
  });

});
define('dummy/tests/routes/overview.jshint', function () {

  'use strict';

  module('JSHint - routes');
  test('routes/overview.js should pass jshint', function() { 
    ok(true, 'routes/overview.js should pass jshint.'); 
  });

});
define('dummy/tests/test-helper', ['dummy/tests/helpers/resolver', 'ember-qunit'], function (resolver, ember_qunit) {

	'use strict';

	ember_qunit.setResolver(resolver['default']);

});
define('dummy/tests/test-helper.jshint', function () {

  'use strict';

  module('JSHint - .');
  test('test-helper.js should pass jshint', function() { 
    ok(true, 'test-helper.js should pass jshint.'); 
  });

});
define('dummy/tests/utils/horizon.jshint', function () {

  'use strict';

  module('JSHint - utils');
  test('utils/horizon.js should pass jshint', function() { 
    ok(true, 'utils/horizon.js should pass jshint.'); 
  });

});
define('dummy/tests/utils/number-format.jshint', function () {

  'use strict';

  module('JSHint - utils');
  test('utils/number-format.js should pass jshint', function() { 
    ok(true, 'utils/number-format.js should pass jshint.'); 
  });

});
define('dummy/tests/views/ajax-image-table-cell.jshint', function () {

  'use strict';

  module('JSHint - views');
  test('views/ajax-image-table-cell.js should pass jshint', function() { 
    ok(true, 'views/ajax-image-table-cell.js should pass jshint.'); 
  });

});
define('dummy/tests/views/ajax-table-lazy-data-source.jshint', function () {

  'use strict';

  module('JSHint - views');
  test('views/ajax-table-lazy-data-source.js should pass jshint', function() { 
    ok(true, 'views/ajax-table-lazy-data-source.js should pass jshint.'); 
  });

});
define('dummy/tests/views/bar-table-cell.jshint', function () {

  'use strict';

  module('JSHint - views');
  test('views/bar-table-cell.js should pass jshint', function() { 
    ok(true, 'views/bar-table-cell.js should pass jshint.'); 
  });

});
define('dummy/tests/views/configurable-column-definition.jshint', function () {

  'use strict';

  module('JSHint - views');
  test('views/configurable-column-definition.js should pass jshint', function() { 
    ok(true, 'views/configurable-column-definition.js should pass jshint.'); 
  });

});
define('dummy/tests/views/date-picker-table-cell.jshint', function () {

  'use strict';

  module('JSHint - views');
  test('views/date-picker-table-cell.js should pass jshint', function() { 
    ok(true, 'views/date-picker-table-cell.js should pass jshint.'); 
  });

});
define('dummy/tests/views/editable-table-cell.jshint', function () {

  'use strict';

  module('JSHint - views');
  test('views/editable-table-cell.js should pass jshint', function() { 
    ok(true, 'views/editable-table-cell.js should pass jshint.'); 
  });

});
define('dummy/tests/views/financial-table-cell.jshint', function () {

  'use strict';

  module('JSHint - views');
  test('views/financial-table-cell.js should pass jshint', function() { 
    ok(true, 'views/financial-table-cell.js should pass jshint.'); 
  });

});
define('dummy/tests/views/financial-table-header-cell.jshint', function () {

  'use strict';

  module('JSHint - views');
  test('views/financial-table-header-cell.js should pass jshint', function() { 
    ok(true, 'views/financial-table-header-cell.js should pass jshint.'); 
  });

});
define('dummy/tests/views/financial-table-header-tree-cell.jshint', function () {

  'use strict';

  module('JSHint - views');
  test('views/financial-table-header-tree-cell.js should pass jshint', function() { 
    ok(true, 'views/financial-table-header-tree-cell.js should pass jshint.'); 
  });

});
define('dummy/tests/views/financial-table-tree-cell.jshint', function () {

  'use strict';

  module('JSHint - views');
  test('views/financial-table-tree-cell.js should pass jshint', function() { 
    ok(true, 'views/financial-table-tree-cell.js should pass jshint.'); 
  });

});
define('dummy/tests/views/financial-table-tree-row.jshint', function () {

  'use strict';

  module('JSHint - views');
  test('views/financial-table-tree-row.js should pass jshint', function() { 
    ok(true, 'views/financial-table-tree-row.js should pass jshint.'); 
  });

});
define('dummy/tests/views/horizon-table-cell.jshint', function () {

  'use strict';

  module('JSHint - views');
  test('views/horizon-table-cell.js should pass jshint', function() { 
    ok(true, 'views/horizon-table-cell.js should pass jshint.'); 
  });

});
define('dummy/tests/views/rating-table-cell.jshint', function () {

  'use strict';

  module('JSHint - views');
  test('views/rating-table-cell.js should pass jshint', function() { 
    ok(true, 'views/rating-table-cell.js should pass jshint.'); 
  });

});
define('dummy/tests/views/sparkline-table-cell.jshint', function () {

  'use strict';

  module('JSHint - views');
  test('views/sparkline-table-cell.js should pass jshint', function() { 
    ok(true, 'views/sparkline-table-cell.js should pass jshint.'); 
  });

});
define('dummy/utils/horizon', ['exports'], function (exports) {

  'use strict';

  // TODO(azirbel): Clean up this util library

  ///////////////////////////////////////////////////////////////////////////////
  // Helper functions
  ///////////////////////////////////////////////////////////////////////////////

  var d3_horizonArea = d3.svg.area();
  var d3_horizonId = 0;

  function d3_horizonX(d) {
    return d[0];
  }

  function d3_horizonY(d) {
    return d[1];
  }

  function d3_horizonTransform(bands, h, mode) {
    return mode === 'offset' ? function (d) {
      return 'translate(0,' + (d + (d < 0) - bands) * h + ')';
    } : function (d) {
      return (d < 0 ? 'scale(1,-1)' : '') + 'translate(0,' + (d - bands) * h + ')';
    };
  }

  ///////////////////////////////////////////////////////////////////////////////
  // Functions to export
  ///////////////////////////////////////////////////////////////////////////////

  exports['default'] = {
    d3Horizon: function d3Horizon() {
      var bands = 1,
          // between 1 and 5, typically
      mode = 'offset',
          // or mirror
      interpolate = 'linear',
          // or basis, monotone, step-before, etc.
      x = d3_horizonX,
          y = d3_horizonY,
          w = 960,
          h = 40,
          duration = 0;

      var color = d3.scale.linear().domain([-1, 0, 1]).range(['#d62728', '#fff', '#1f77b4']);

      // For each small multiple…
      function horizon(g) {
        g.each(function (d) {
          var g = d3.select(this),
              xMin = Infinity,
              xMax = -Infinity,
              yMax = -Infinity,
              x0,
              // old x-scale
          y0,
              // old y-scale
          t0,
              id; // unique id for paths

          // Compute x- and y-values along with extents.
          var data = d.map(function (d, i) {
            var xv = x.call(this, d, i);
            var yv = y.call(this, d, i);
            if (xv < xMin) {
              xMin = xv;
            }
            if (xv > xMax) {
              xMax = xv;
            }
            if (-yv > yMax) {
              yMax = -yv;
            }
            if (yv > yMax) {
              yMax = yv;
            }
            return [xv, yv];
          });

          // Compute the new x- and y-scales, and transform.
          var x1 = d3.scale.linear().domain([xMin, xMax]).range([0, w]),
              y1 = d3.scale.linear().domain([0, yMax]).range([0, h * bands]),
              t1 = d3_horizonTransform(bands, h, mode);

          // Retrieve the old scales, if this is an update.
          if (this.__chart__) {
            x0 = this.__chart__.x;
            y0 = this.__chart__.y;
            t0 = this.__chart__.t;
            id = this.__chart__.id;
          } else {
            x0 = x1.copy();
            y0 = y1.copy();
            t0 = t1;
            id = ++d3_horizonId;
          }

          // We'll use a defs to store the area path and the clip path.
          var defs = g.selectAll('defs').data([null]);

          // The clip path is a simple rect.
          defs.enter().append('defs').append('clipPath').attr('id', 'd3_horizon_clip' + id).append('rect').attr('width', w).attr('height', h);

          defs.select('rect').transition().duration(duration).attr('width', w).attr('height', h);

          // We'll use a container to clip all horizon layers at once.
          g.selectAll('g').data([null]).enter().append('g').attr('clip-path', 'url(#d3_horizon_clip' + id + ')');

          // Instantiate each copy of the path with different transforms.
          var path = g.select('g').selectAll('path').data(d3.range(-1, -bands - 1, -1).concat(d3.range(1, bands + 1)), Number);

          var d0 = d3_horizonArea.interpolate(interpolate).x(function (d) {
            return x0(d[0]);
          }).y0(h * bands).y1(function (d) {
            return h * bands - y0(d[1]);
          })(data);

          var d1 = d3_horizonArea.x(function (d) {
            return x1(d[0]);
          }).y1(function (d) {
            return h * bands - y1(d[1]);
          })(data);

          path.enter().append('path').style('fill', color).attr('transform', t0).attr('d', d0);

          path.transition().duration(duration).style('fill', color).attr('transform', t1).attr('d', d1);

          path.exit().transition().duration(duration).attr('transform', t1).attr('d', d1).remove();

          // Stash the new scales.
          this.__chart__ = { x: x1, y: y1, t: t1, id: id };
        });
        d3.timer.flush();
      }

      horizon.duration = function (x) {
        if (!arguments.length) {
          return duration;
        }
        duration = +x;
        return horizon;
      };

      horizon.bands = function (x) {
        if (!arguments.length) {
          return bands;
        }
        bands = +x;
        color.domain([-bands, 0, bands]);
        return horizon;
      };

      horizon.mode = function (x) {
        if (!arguments.length) {
          return mode;
        }
        mode = x + '';
        return horizon;
      };

      horizon.colors = function (x) {
        if (!arguments.length) {
          return color.range();
        }
        color.range(x);
        return horizon;
      };

      horizon.interpolate = function (x) {
        if (!arguments.length) {
          return interpolate;
        }
        interpolate = x + '';
        return horizon;
      };

      horizon.x = function (z) {
        if (!arguments.length) {
          return x;
        }
        x = z;
        return horizon;
      };

      horizon.y = function (z) {
        if (!arguments.length) {
          return y;
        }
        y = z;
        return horizon;
      };

      horizon.width = function (x) {
        if (!arguments.length) {
          return w;
        }
        w = +x;
        return horizon;
      };

      horizon.height = function (x) {
        if (!arguments.length) {
          return h;
        }
        h = +x;
        return horizon;
      };

      return horizon;
    }
  };

});
define('dummy/utils/number-format', ['exports'], function (exports) {

  'use strict';

  // HACK: Used to help format table cells, should be refactored or use a library
  // TODO(azirbel): Should be a handlebars helper
  exports['default'] = {
    toCurrency: function toCurrency(num) {
      var value;
      if (isNaN(num) || !isFinite(num)) {
        return '-';
      }
      value = Math.abs(num).toFixed(2);
      value = value.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,');
      return (num < 0 ? '-$' : '$') + value;
    },

    toPercent: function toPercent(num) {
      if (isNaN(num) || !isFinite(num)) {
        return '-';
      }
      return Math.abs(num * 100).toFixed(2) + '%';
    }
  };

});
define('dummy/views/ajax-image-table-cell', ['exports', 'ember-table/views/table-cell'], function (exports, TableCell) {

  'use strict';

  exports['default'] = TableCell['default'].extend({
    templateName: 'ajax-table/ajax-cell',
    classNames: 'img-table-cell'
  });

});
define('dummy/views/ajax-table-lazy-data-source', ['exports', 'ember'], function (exports, Ember) {

  'use strict';

  exports['default'] = Ember['default'].ArrayProxy.extend({
    createGithubEvent: function createGithubEvent(row, event) {
      row.set('type', event.type);
      row.set('createdAt', event.created_at);
      row.set('login', event.actor.login);
      row.set('avatar', event.actor.avatar_url);
      row.set('isLoaded', true);
      return row;
    },

    requestGithubEvent: function requestGithubEvent(page) {
      var _this = this;
      var content = this.get('content');
      var start = (page - 1) * 30;
      var end = start + 30;
      var url = 'https://api.github.com/repos/emberjs/ember.js/events?page=' + page + '&per_page=30&callback=?';
      Ember['default'].$.getJSON(url, function (json) {
        return json.data.forEach(function (event, index) {
          var row = content[start + index];
          return _this.createGithubEvent(row, event);
        });
      });
      for (var index = start; index < end; index++) {
        content[index] = Ember['default'].Object.create({
          eventId: index,
          isLoaded: false
        });
      }
    },

    objectAt: function objectAt(index) {
      var content = this.get('content');
      var row = content[index];
      if (row && !row.get('error')) {
        return row;
      }
      this.requestGithubEvent(Math.floor(index / 30 + 1));
      return content[index];
    }
  });

});
define('dummy/views/bar-table-cell', ['exports', 'ember', 'ember-table/views/table-cell'], function (exports, Ember, TableCell) {

  'use strict';

  exports['default'] = TableCell['default'].extend({
    templateName: 'bar_table/bar-cell',
    classNameBindings: ['column.color'],

    barWidth: Ember['default'].computed(function () {
      var properties = this.getProperties('column', 'row');
      var column = properties.column;
      var row = properties.row;
      if (!(column && row)) {
        return 0;
      }
      return Math.round(+this.get('cellContent'));
    }).property('column', 'row', 'cellContent'),

    histogramStyle: Ember['default'].computed(function () {
      return 'width: ' + this.get('barWidth') + '%;';
    }).property('barWidth')
  });

});
define('dummy/views/body-table-container', ['exports', 'ember-table/views/body-table-container'], function (exports, BodyTableContainer) {

	'use strict';

	exports['default'] = BodyTableContainer['default'];

});
define('dummy/views/column-sortable-indicator', ['exports', 'ember-table/views/column-sortable-indicator'], function (exports, ColumnSortableIndicator) {

	'use strict';

	exports['default'] = ColumnSortableIndicator['default'];

});
define('dummy/views/configurable-column-definition', ['exports', 'ember', 'ember-table/models/column-definition'], function (exports, Ember, ColumnDefinition) {

  'use strict';

  exports['default'] = ColumnDefinition['default'].extend({
    savedWidth: void 0,

    savedWidthValue: Ember['default'].computed(function (key, value) {
      if (arguments.length === 1) {
        return this.get('savedWidth');
      } else {
        this.set('savedWidth', parseInt(value));
        return this.get('savedWidth');
      }
    }).property('savedWidth'),

    minWidthValue: Ember['default'].computed(function (key, value) {
      if (arguments.length === 1) {
        return this.get('minWidth');
      } else {
        this.set('minWidth', parseInt(value));
        return this.get('minWidth');
      }
    }).property('minWidth'),

    atMinWidth: Ember['default'].computed(function () {
      return this.get('width') === this.get('minWidth');
    }).property('width', 'minWidth'),

    atMaxWidth: Ember['default'].computed(function () {
      return this.get('width') === this.get('maxWidth');
    }).property('width', 'maxWidth'),

    maxWidth: undefined,

    maxWidthValue: Ember['default'].computed(function (key, value) {
      if (arguments.length === 1) {
        return this.get('maxWidth');
      } else {
        this.set('maxWidth', parseInt(value));
        return this.get('maxWidth');
      }
    }).property('maxWidth'),

    columnDefinitionDocumentation: Ember['default'].computed(function () {
      var docString = '';
      docString += '    var ' + this.get('headerCellName').toLowerCase() + 'Column = ColumnDefinition.create({\n';
      if (this.get('textAlign') !== 'text-align-right') {
        docString += '      textAlign: \'' + this.get('textAlign') + '\',\n';
      }
      docString += '      headerCellName: \'' + this.get('headerCellName') + '\',\n';
      if (this.get('minWidth') !== 25) {
        docString += '      minWidth: ' + this.get('minWidth') + ',\n';
      }
      if (this.get('maxWidth')) {
        docString += '      maxWidth: ' + this.get('maxWidth') + ',\n';
      }
      if (!this.get('isSortable')) {
        docString += '      isSortable: false,\n';
      }
      if (!this.get('isResizable')) {
        docString += '      isResizable: false,\n';
      }
      if (this.get('canAutoResize')) {
        docString += '      canAutoResize: true,\n';
      }
      if (this.get('headerCellName') === 'Date') {
        docString += '      getCellContent: function(row) {\n' + '        return row.get(\'date\').toDateString();\n' + '      }\n';
      } else {
        docString += '      getCellContent: function(row) {\n' + '        return row.get(\'' + this.get('headerCellName').toLowerCase() + '\').toFixed(2);\n' + '      }\n';
      }
      docString += '    });';
      return docString;
    }).property('headerCellName', 'textAlign', 'minWidth', 'maxWidth', 'isSortable', 'isResizable', 'canAutoResize')
  });

});
define('dummy/views/date-picker-table-cell', ['exports', 'dummy/views/editable-table-cell'], function (exports, EditableTableCell) {

  'use strict';

  exports['default'] = EditableTableCell['default'].extend({
    type: 'date'
  });

});
define('dummy/views/editable-table-cell', ['exports', 'ember', 'ember-table/views/table-cell'], function (exports, Ember, TableCell) {

  'use strict';

  exports['default'] = TableCell['default'].extend({
    className: 'editable-table-cell',
    templateName: 'editable-table/editable-table-cell',
    isEditing: false,
    type: 'text',

    innerTextField: Ember['default'].TextField.extend({
      typeBinding: 'parentView.type',
      valueBinding: 'parentView.cellContent',
      didInsertElement: function didInsertElement() {
        this.$().focus();
        // TODO(azirbel): Call this._super()
      },
      focusOut: function focusOut() {
        this.set('parentView.isEditing', false);
      }
    }),

    onRowContentDidChange: Ember['default'].observer(function () {
      this.set('isEditing', false);
    }, 'row.content'),

    click: function click(event) {
      this.set('isEditing', true);
      event.stopPropagation();
    }
  });

});
define('dummy/views/financial-table-cell', ['exports', 'ember-table/views/table-cell'], function (exports, TableCell) {

  'use strict';

  exports['default'] = TableCell['default'].extend({
    templateName: 'financial-table/financial-table-cell'
  });

});
define('dummy/views/financial-table-header-cell', ['exports', 'ember-table/views/header-cell'], function (exports, HeaderCell) {

  'use strict';

  exports['default'] = HeaderCell['default'].extend({
    templateName: 'financial-table/financial-table-header-cell'
  });

});
define('dummy/views/financial-table-header-tree-cell', ['exports', 'ember-table/views/header-cell'], function (exports, HeaderCell) {

  'use strict';

  exports['default'] = HeaderCell['default'].extend({
    templateName: 'financial-table/financial-table-header-tree-cell',
    classNames: 'ember-table-table-header-tree-cell'
  });

});
define('dummy/views/financial-table-tree-cell', ['exports', 'ember', 'ember-table/views/table-cell'], function (exports, Ember, TableCell) {

  'use strict';

  exports['default'] = TableCell['default'].extend({
    templateName: 'financial-table/financial-table-tree-cell',
    classNames: 'ember-table-table-tree-cell',

    paddingStyle: Ember['default'].computed(function () {
      return 'padding-left:' + this.get('row.indentation') + 'px;';
    }).property('row.indentation')
  });

});
define('dummy/views/financial-table-tree-row', ['exports', 'ember-table/controllers/row'], function (exports, Row) {

  'use strict';

  exports['default'] = Row['default'].extend({
    content: null,
    children: null,
    parent: null,
    isRoot: false,
    isLeaf: false,
    isCollapsed: false,
    isShowing: true,
    indentationSpacing: 20,
    groupName: null,

    computeStyles: function computeStyles(parent) {
      var groupingLevel, indentType, indentation, isShowing, pGroupingLevel, spacing;
      groupingLevel = 0;
      indentation = 0;
      isShowing = true;
      if (parent) {
        isShowing = parent.get('isShowing') && !parent.get('isCollapsed');
        pGroupingLevel = parent.get('groupingLevel');
        groupingLevel = pGroupingLevel;
        if (parent.get('groupName') !== this.get('groupName')) {
          groupingLevel += 1;
        }
        indentType = groupingLevel === pGroupingLevel ? 'half' : 'full';
        spacing = this.get('indentationSpacing');
        if (!parent.get('isRoot')) {
          indentation = parent.get('indentation');
          indentation += indentType === 'half' ? spacing / 2 : spacing;
        }
      }
      this.set('groupingLevel', groupingLevel);
      this.set('indentation', indentation);
      this.set('isShowing', isShowing);
    },

    computeRowStyle: function computeRowStyle(maxLevels) {
      var level;
      level = this.getFormattingLevel(this.get('groupingLevel'), maxLevels);
      this.set('rowStyle', 'ember-table-row-style-' + level);
    },

    recursiveCollapse: function recursiveCollapse(isCollapsed) {
      this.set('isCollapsed', isCollapsed);
      this.get('children').forEach(function (child) {
        child.recursiveCollapse(isCollapsed);
      });
    },

    getFormattingLevel: function getFormattingLevel(level, maxLevels) {
      switch (maxLevels) {
        case 1:
          return 5;
        case 2:
          if (level === 1) {
            return 2;
          }
          return 5;
        case 3:
          if (level === 1) {
            return 1;
          }
          if (level === 2) {
            return 3;
          }
          return 5;
        case 4:
          if (level === 1) {
            return 1;
          }
          if (level === 2) {
            return 2;
          }
          if (level === 4) {
            return 4;
          }
          return 5;
        case 5:
          return level;
        default:
          if (level === maxLevels) {
            return 5;
          }
          return Math.min(level, 4);
      }
    }
  });

});
define('dummy/views/footer-table-container', ['exports', 'ember-table/views/footer-table-container'], function (exports, FooterTableContainer) {

	'use strict';

	exports['default'] = FooterTableContainer['default'];

});
define('dummy/views/header-block', ['exports', 'ember-table/views/header-block'], function (exports, HeaderBlock) {

	'use strict';

	exports['default'] = HeaderBlock['default'];

});
define('dummy/views/header-cell', ['exports', 'ember-table/views/header-cell'], function (exports, HeaderCell) {

	'use strict';

	exports['default'] = HeaderCell['default'];

});
define('dummy/views/header-row', ['exports', 'ember-table/views/header-row'], function (exports, HeaderRow) {

	'use strict';

	exports['default'] = HeaderRow['default'];

});
define('dummy/views/header-table-container', ['exports', 'ember-table/views/header-table-container'], function (exports, HeaderTableContainer) {

	'use strict';

	exports['default'] = HeaderTableContainer['default'];

});
define('dummy/views/horizon-table-cell', ['exports', 'ember', 'ember-table/views/table-cell', 'dummy/utils/horizon'], function (exports, Ember, TableCell, d3HorizonUtils) {

  'use strict';

  exports['default'] = TableCell['default'].extend({
    templateName: 'empty-cell',
    heightBinding: 'controller.rowHeight',

    horizonContent: Ember['default'].computed(function () {
      var normal = d3.random.normal(1.5, 3);
      var content = [];
      for (var i = 0; i < 100; i++) {
        content.pushObject([i, normal()]);
      }
      return content;
    }).property(),

    onWidthDidChange: Ember['default'].observer(function () {
      this.$('svg').remove();
      this.renderD3View();
    }, 'width'),

    didInsertElement: function didInsertElement() {
      this.onWidthDidChange();
      // TODO(azirbel): Add _this.super()
    },

    renderD3View: function renderD3View() {
      var chart, data, height, svg, width;
      width = this.get('width');
      height = this.get('height');
      data = this.get('horizonContent');
      chart = d3HorizonUtils['default'].d3Horizon().width(width).height(height).bands(2).mode('mirror').interpolate('basis');
      svg = d3.select('#' + this.get('elementId')).append('svg').attr('width', width).attr('height', height);
      svg.data([data]).call(chart);
    }
  });

});
define('dummy/views/lazy-table-block', ['exports', 'ember-table/views/lazy-table-block'], function (exports, LazyTableBlock) {

	'use strict';

	exports['default'] = LazyTableBlock['default'];

});
define('dummy/views/multi-item-collection', ['exports', 'ember-table/views/multi-item-collection'], function (exports, MultiItemCollection) {

	'use strict';

	exports['default'] = MultiItemCollection['default'];

});
define('dummy/views/rating-table-cell', ['exports', 'ember', 'ember-table/views/table-cell'], function (exports, Ember, TableCell) {

  'use strict';

  exports['default'] = TableCell['default'].extend({
    classNames: 'rating-table-cell',
    templateName: 'editable-table/rating-table-cell',

    onRowContentDidChange: Ember['default'].observer(function () {
      this.applyRating(this.get('cellContent'));
    }, 'cellContent'),

    didInsertElement: function didInsertElement() {
      this._super();
      this.onRowContentDidChange();
    },

    applyRating: function applyRating(rating) {
      this.$('.rating span').removeClass('active');
      var span = this.$('.rating span').get(rating);
      Ember['default'].$(span).addClass('active');
    },

    click: function click(event) {
      var rating = this.$('.rating span').index(event.target);
      if (rating === -1) {
        return;
      }
      this.get('column').setCellContent(this.get('row'), rating);
      this.applyRating(rating);
    }
  });

});
define('dummy/views/scroll-container', ['exports', 'ember-table/views/scroll-container'], function (exports, ScrollContainer) {

	'use strict';

	exports['default'] = ScrollContainer['default'];

});
define('dummy/views/scroll-panel', ['exports', 'ember-table/views/scroll-panel'], function (exports, ScrollPanel) {

	'use strict';

	exports['default'] = ScrollPanel['default'];

});
define('dummy/views/sparkline-table-cell', ['exports', 'ember', 'ember-table/views/table-cell'], function (exports, Ember, TableCell) {

  'use strict';

  exports['default'] = TableCell['default'].extend({
    templateName: 'empty-cell',
    heightBinding: 'controller.rowHeight',

    onContentOrSizeDidChange: Ember['default'].observer(function () {
      this.$('svg').remove();
      this.renderD3View();
    }, 'row', 'width'),

    didInsertElement: function didInsertElement() {
      this.renderD3View();
      // TODO(azirbel): Add _this.super()
    },

    renderD3View: function renderD3View() {
      var data = this.get('row.timeseries');
      if (!data) {
        return;
      }
      var h = this.get('height');
      var w = this.get('width');
      var p = 2;
      var min = Math.min.apply(null, data);
      var max = Math.max.apply(null, data);
      var len = data.length;
      var fill = d3.scale.category10();
      var xscale = d3.scale.linear().domain([0, len]).range([p, w - p]);
      var yscale = d3.scale.linear().domain([min, max]).range([h - p, p]);
      var line = d3.svg.line().x(function (d, i) {
        return xscale(i);
      }).y(function (d) {
        return yscale(d);
      });
      var svg = d3.select('#' + this.get('elementId')).append('svg:svg').attr('height', h).attr('width', w);
      var g = svg.append('svg:g');
      g.append('svg:path').attr('d', line(data)).attr('stroke', function () {
        return fill(Math.round(Math.random()) * 10);
      }).attr('fill', 'none');
    }
  });

});
define('dummy/views/table-block', ['exports', 'ember-table/views/table-block'], function (exports, TableBlock) {

	'use strict';

	exports['default'] = TableBlock['default'];

});
define('dummy/views/table-cell', ['exports', 'ember-table/views/table-cell'], function (exports, TableCell) {

	'use strict';

	exports['default'] = TableCell['default'];

});
define('dummy/views/table-row', ['exports', 'ember-table/views/table-row'], function (exports, TableRow) {

	'use strict';

	exports['default'] = TableRow['default'];

});
/* jshint ignore:start */

/* jshint ignore:end */

/* jshint ignore:start */

define('dummy/config/environment', ['ember'], function(Ember) {
  var prefix = 'dummy';
/* jshint ignore:start */

try {
  var metaName = prefix + '/config/environment';
  var rawConfig = Ember['default'].$('meta[name="' + metaName + '"]').attr('content');
  var config = JSON.parse(unescape(rawConfig));

  return { 'default': config };
}
catch(err) {
  throw new Error('Could not read config from meta tag with name "' + metaName + '".');
}

/* jshint ignore:end */

});

if (runningTests) {
  require("dummy/tests/test-helper");
} else {
  require("dummy/app")["default"].create({"name":"ember-table","version":"0.9.0+c3596470"});
}

/* jshint ignore:end */
//# sourceMappingURL=dummy.map