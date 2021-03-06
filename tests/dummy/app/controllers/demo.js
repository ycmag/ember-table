import Controller from '@ember/controller';
import TreeNode from '../utils/tree-node';
import LinkedListTree from '../utils/linked-list-tree';
import { computed } from '@ember/object';
import EmberObject from '@ember/object';
import { A as emberA } from '@ember/array';

const COLUMN_COUNT = 13;

export default Controller.extend({
  showTable: true,
  showPanel: false,

  getRow(title) {
    let alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let row = EmberObject.create({
      'id': title
    });
    for (let j = 0; j < COLUMN_COUNT; j++) {
      row.set(alphabet[j], alphabet[j]);
    }
    return row;
  },

  rows: computed(function() {
    let topRow = new TreeNode(null, this.getRow('Top Row'));
    for (let i = 0; i < 10; i++) {
      let header = new TreeNode(topRow, this.getRow(`Header ${i}`));
      for (let j = 0; j < 10; j++) {
        let group = new TreeNode(header, this.getRow(`Group ${j}`));
        for (let k = 0; k < 10; k++) {
          group.addChild(new TreeNode(group, this.getRow(`Leaf ${k}`)));
        }

        header.addChild(group);
      }

      topRow.addChild(header);
    }

    let root = new TreeNode(null, null);
    root.addChild(topRow);

    return new LinkedListTree(root);
  }),

  columns: computed(function() {
    let arr = emberA();
    let alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let columnWidth = 180;

    arr.pushObject({
      columnName: 'Column id',
      valuePath: 'id',
      width: columnWidth,
      cellComponent: 'tree-table-grouping-cell'
    });

    for (let j = 0; j < COLUMN_COUNT; j++) {
      arr.pushObject({
        columnName: `Col ${alphabet[j % 26]}`,
        valuePath: alphabet[j % 26],
        width: columnWidth,
        isResizable: true,
        isReorderable: true
      });
    }

    return arr;
  }),

  actions: {
    onCellClicked(cell) {
      if (cell.get('columnIndex') !== 0) {
        cell.set('wasClicked', true);
      }
    }
  }
});
