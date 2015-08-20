import Ember from 'ember';
import StyleBindingsMixin from 'ember-table/mixins/style-bindings';
import RegisterTableComponentMixin from 'ember-table/mixins/register-table-component';

export default Ember.View.extend(
RegisterTableComponentMixin, StyleBindingsMixin, {
  templateName: 'table-row',
  classNames: 'ember-table-table-row',
  classNameBindings: ['row.isHovered:ember-table-hover',
      'row.isSelected:ember-table-selected',
      'row.rowStyle',
      'isLastRow:ember-table-last-row'],
  styleBindings: ['width', 'height', 'width', 'top', 'display'],
  row: Ember.computed.alias('content'),
  columns: Ember.A,
  width: Ember.computed.alias('rowWidth'),
  height: Ember.computed.alias('rowHeight'),

  prepareContent: Ember.K,

  top: Ember.computed(function() {
    return this.get('row.itemIndex') * this.get('rowHeight');
  }).property('itemIndex', 'rowHeight'),

  // TODO(azirbel): Add explicit else case
  display: Ember.computed(function() {
    if (!this.get('content')) {
      return 'none';
    }
  }).property('content'),

  // Use `lastItem` (set manually) instead of the array's built-in `lastObject`
  // to avoid creating a controller for last row on table initialization.  If
  // this TableRow is the last row, then the row controller should have been
  // created and set to `lastItem` in RowArrayController, otherwise `lastItem`
  // is null.
  isLastRow: Ember.computed(function() {
    return this.get('row') ===
        this.get('tableComponent.bodyContent.lastItem');
  }).property('tableComponent.bodyContent.lastItem', 'row'),

  // TODO(azirbel): Could simplify slightly via
  // this.set('row.isHovered', true) and remove the temp variable.
  // Also applies below/elsewhere.
  mouseEnter: function() {
    var row = this.get('row');
    if (row) {
      row.set('isHovered', true);
    }
  },

  mouseLeave: function() {
    var row = this.get('row');
    if (row) {
      row.set('isHovered', false);
    }
  },

  teardownContent: function() {
    var row = this.get('row');
    if (row) {
      row.set('isHovered', false);
    }
  }
});
