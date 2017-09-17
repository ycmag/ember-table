import Ember from 'ember';
import TableContainer from 'ember-table-one/views/table-container';
import ShowHorizontalScrollMixin from 'ember-table-one/mixins/show-horizontal-scroll';
import RegisterTableComponentMixin from 'ember-table-one/mixins/register-table-component';

export default TableContainer.extend(
ShowHorizontalScrollMixin, RegisterTableComponentMixin, {
  templateName: 'header-table-container',
  classNames: ['ember-table-table-container',
      'ember-table-fixed-table-container',
      'ember-table-header-container'],
  height: Ember.computed.alias('tableComponent._headerHeight'),
  width: Ember.computed.alias('tableComponent._tableContainerWidth')
});
