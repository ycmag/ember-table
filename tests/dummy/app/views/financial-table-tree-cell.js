// BEGIN-SNIPPET financial-table-tree-cell
import Ember from 'ember';
import TableCell from 'ember-table/views/table-cell';

export default TableCell.extend({
  templateName: 'financial-table/financial-table-tree-cell',
  classNames: 'ember-table-table-tree-cell',

  paddingStyle: Ember.computed(function() {
    var safeString = new Ember.Handlebars.SafeString('padding-left:' + (this.get('row.indentation')) + 'px;');
    return safeString.string;
  }).property('row.indentation')
});
// END-SNIPPET
