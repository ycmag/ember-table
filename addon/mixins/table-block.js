import Ember from 'ember';
import StyleBindingsMixin from './style-bindings';

export default Ember.Mixin.create(
StyleBindingsMixin, {
  classNames: ['ember-table-table-block'],
  styleBindings: ['width', 'height'],
  itemViewClass: null,
  columns: null,
  content: null,
  scrollLeft: null,
  width: null,
  height: null,

  onScrollLeftDidChange: Ember.observer('scrollLeft', function() {
    this.$().scrollLeft(this.get('scrollLeft'));
  }),


});
