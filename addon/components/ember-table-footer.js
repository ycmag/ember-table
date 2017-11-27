import EmberTableBaseCell from './ember-table-base-cell';
import { property } from '../utils/class';
import { computed } from 'ember-decorators/object';
import { get } from '@ember/object';

import layout from '../templates/components/ember-table-footer';

export default class EmberTableFooter extends EmberTableBaseCell {
  @property layout = layout;
  @property tagName = 'td';
  @property classNameBindings = ['isFixed::et-tf'];

  @computed('column', 'footerRowIndex')
  footerValue() {
    let column = this.get('column');
    let footerValues = get(column, 'footerValues');

    return footerValues[this.get('footerRowIndex')];
  }
}
