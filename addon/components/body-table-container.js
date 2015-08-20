import Ember from 'ember';
import TableContainer from 'ember-table/mixins/table-container';
import ShowHorizontalScrollMixin from 'ember-table/mixins/show-horizontal-scroll';
import MouseWheelHandlerMixin from 'ember-table/mixins/mouse-wheel-handler';
import TouchMoveHandlerMixin from 'ember-table/mixins/touch-move-handler';
import ScrollHandlerMixin from 'ember-table/mixins/scroll-handler';

export default Ember.Component.extend( TableContainer,
MouseWheelHandlerMixin, TouchMoveHandlerMixin, ScrollHandlerMixin,
ShowHorizontalScrollMixin, {

  classNames: ['ember-table-table-container',
      'ember-table-body-container',
      'antiscroll-wrap'],

  bodyHeight: null,
  bodyWidth: null,
  scrollLeft: null,
  height: Ember.computed.alias('bodyHeight'),
  width: Ember.computed.alias('bodyWidth'),
  // TODO (Artych) where it should be
  scrollElementSelector: '.antiscroll-inner',

  _numItemsShowing: Ember.computed(function() {
    return Math.floor(this.get('bodyHeight') / this.get('rowHeight'));
  }).property('bodyHeight', 'rowHeight'),

  _scrollTop: 0,

  _startIndex: Ember.computed('_scrollTop', 'bodyContent.length', '_numItemsShowing', 
      'rowHeight', function() {
    var numContent = this.get('bodyContent.length');
    var numViews = this.get('_numItemsShowing');
    var rowHeight = this.get('rowHeight');
    var _scrollTop = this.get('_scrollTop');
    var index = Math.floor(_scrollTop / rowHeight);
    // Adjust start index so that end index doesn't exceed content length
    if (index + numViews >= numContent) {
      index = numContent - numViews;
    }
    return Math.max(index, 0);
  }),

  onScroll: function(event) {
    this.set('_scrollTop', event.target.scrollTop);
    return event.preventDefault();
  },

  // `event` here is a jQuery event
  onMouseWheel: function(event, delta, deltaX, deltaY) {
    if (Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }
    var scrollLeft = this.$('.ember-table-right-table-block').scrollLeft() + deltaX;
    this.set('scrollLeft', scrollLeft);
    event.preventDefault();
  },

  // `event` here is a jQuery event
  onTouchMove: function(event, deltaX, deltaY) {
    if (Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }
    var scrollLeft = this.$('.ember-table-right-table-block').scrollLeft() + deltaX;
    this.set('scrollLeft', scrollLeft);
    event.preventDefault();
  },

  actions: {
    rowDidClick: function(row, event) {
      console.log('buble body container');
      this.sendAction('rowDidClick', row, event);
    },

    toggleRowCollapse: function(row) {
      this.sendAction('toggleRowCollapse', row);
    }
  }
});
