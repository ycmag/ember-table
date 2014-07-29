###*
 * Multi Item View Collection View
 * @class
 * @alias Ember.Table.MultiItemViewCollectionView
 ###
Ember.MultiItemViewCollectionView =
Ember.CollectionView.extend Ember.AddeparMixins.StyleBindingsMixin,
  styleBindings:  'width'
  itemViewClassField: null
  createChildView: (view, attrs) ->
    itemViewClassField = @get 'itemViewClassField'
    itemViewClass = attrs.content.get(itemViewClassField)
    if typeof itemViewClass is 'string'
      itemViewClass = Ember.get Ember.lookup, itemViewClass
    @_super(itemViewClass, attrs)

Ember.MouseWheelHandlerMixin = Ember.Mixin.create
  onMouseWheel: Ember.K
  didInsertElement: ->
    @_super()
    @$().bind 'mousewheel', (event, delta, deltaX, deltaY) =>
      Ember.run this, @onMouseWheel, event, delta, deltaX, deltaY
  willDestroyElement: ->
    @$()?.unbind 'MouseWheelHandlerMixin'
    @_super()

Ember.ScrollHandlerMixin = Ember.Mixin.create
  onScroll: Ember.K
  scrollElementSelector: ''
  didInsertElement: ->
    @_super()
    @$(@get('scrollElementSelector')).bind 'scroll', (event) =>
      Ember.run this, @onScroll, event
  willDestroyElement: ->
    @$(@get('scrollElementSelector'))?.unbind 'scroll'
    @_super()

Ember.TouchMoveHandlerMixin = Ember.Mixin.create
  onTouchMove: Ember.K
  didInsertElement: ->
    @_super()
    startX = startY = 0

    @$().bind 'touchstart', (event) ->
      startX = event.originalEvent.targetTouches[0].pageX
      startY = event.originalEvent.targetTouches[0].pageY
      return

    @$().bind 'touchmove', (event) =>
      newX = event.originalEvent.targetTouches[0].pageX
      newY = event.originalEvent.targetTouches[0].pageY
      deltaX = -(newX - startX)
      deltaY = -(newY - startY)
      Ember.run this, @onTouchMove, event, deltaX, deltaY
      startX = newX
      startY = newY
      return

  willDestroy: ->
    @$()?.unbind 'touchmove'
    @_super()

###*
* Table Row Array Proxy
* @class
* @alias Ember.Table.RowArrayProxy
###
Ember.Table.RowArrayController = Ember.ArrayController.extend
  itemController: null
  content: null
  rowContent: Ember.computed( -> []).property()

  controllerAt: (idx, object, controllerClass) ->
    container = @get 'container'
    subControllers = @get '_subControllers'
    subController = subControllers[idx]

    return subController if subController
    subController = @get('itemController').create
      target: this
      parentController: @get('parentController') or this
      content: object
    subControllers[idx] = subController;
    return subController;

  sortColumn: null

  # Overriding orderBy lets us compare based on sortColumn's custom sorting
  # function rather than sortProperties, which makes the table more flexible.
  orderBy: (a, b) ->
    return 0 unless @get('sortColumn')

    # TODO(azirbel): Ugly hack. Since compareCellValues expects to get
    # Ember.Table.Row objects, we creat them. This works but should not be
    # merged into master.
    rowA = Ember.Table.Row.create
      content: a
      parentController: @get('parentController') or this
    rowB = Ember.Table.Row.create
      content: b
      parentController: @get('parentController') or this
    @get('sortColumn').compareCellValues rowA, rowB

  # Overriding this lets us specify when it should be updated. By default, this
  # is whenever sortProperties changes; we want it to be when sortColumn changes
  arrangedContent: Ember.computed ->
    if @get('content')
      content = @get('content').slice();
      content.sort (item1, item2) =>
        @orderBy(item1, item2)
      content.map (row) =>
        Ember.Table.Row.create
          content: row
          parentController: @get('parentController') or this
  .property 'content', 'sortColumn'

# HACK: We want the horizontal scroll to show on mouse enter and leave.
Ember.Table.ShowHorizontalScrollMixin = Ember.Mixin.create
  mouseEnter: (event) ->
    $tablesContainer = $(event.target).parents('.ember-table-tables-container')
    $horizontalScroll = $tablesContainer.find('.antiscroll-scrollbar-horizontal')
    $horizontalScroll.addClass('antiscroll-scrollbar-shown')

  mouseLeave: (event) ->
    $tablesContainer = $(event.target).parents('.ember-table-tables-container')
    $horizontalScroll = $tablesContainer.find('.antiscroll-scrollbar-horizontal')
    $horizontalScroll.removeClass('antiscroll-scrollbar-shown')
