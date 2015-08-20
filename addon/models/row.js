import Ember from 'ember';

export default Ember.ObjectProxy.extend({
  content: null,

  isShowing: true,
  isHovered: false,
  isSelected: false,

  tableComponent: null,

  isSelected: Ember.computed('tableComponent.selection.[]', {
    set: function(key, val) {
      this.get('tableComponent').setSelected(this, val);
      return this.get('tableComponent').isSelected(this);
    },
    get: function() {
    	return this.get('tableComponent').isSelected(this);
    }
  })
});
