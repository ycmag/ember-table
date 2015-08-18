import Ember from 'ember';
import RegisterTableComponentMixin from 'ember-table/mixins/register-table-component';
import LazyContainerView from 'ember-table/views/lazy-container';

export default LazyContainerView.extend(
RegisterTableComponentMixin, {
  classNames: ['ember-table-table-block'],
  styleBindings: ['width'],
  columns: null,
  scrollLeft: null,

  width: Ember.computed.alias('blockWidth'),

  onScrollLeftDidChange: Ember.observer('scrollLeft', function() {
    this.$().scrollLeft(this.get('scrollLeft'));
  })
});
