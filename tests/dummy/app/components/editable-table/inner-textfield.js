import Ember from 'ember';
export default Ember.TextField.extend({
    type: null,
    value: null,
    didInsertElement: function() {
      this.$().focus();
      // TODO(azirbel): Call this._super()
    },
    focusOut: function() {
      this.sendAction('focusOut');
    }
});