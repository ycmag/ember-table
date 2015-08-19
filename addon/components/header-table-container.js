import Ember from 'ember';
import TableContainer from 'ember-table/mixins/table-container';
import ShowHorizontalScrollMixin from 'ember-table/mixins/show-horizontal-scroll';

export default Ember.Component.extend( TableContainer,
ShowHorizontalScrollMixin, {

  classNames: ['ember-table-table-container',
      'ember-table-fixed-table-container',
      'ember-table-header-container'],
  height: Ember.computed.alias('headerHeight'),
  width: Ember.computed.alias('tableContainerWidth'),

  numFixedColumns: null,
  fixedColumns: null,
  fixedBlockWidth: null,
  tableBlockWidth: null,
  headerHeight: null,
  tableContainerWidth: null,
  scrollLeft: null
});
