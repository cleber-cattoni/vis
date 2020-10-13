var DOMutil = require('../../../DOMutil');

class DrawBackground {
  constructor(props, dom, DOMelements) {
    this.props = props;
    this.dom = dom;
    this.DOMelements = DOMelements;
  }

  renderBackground(y, height) {
    this._drawBackgroundDiv(y + this.props.majorLineHeight, this.props.majorLineWidth + this.props.width, height);
  }

  _drawBackgroundDiv(y, width, height) {
    var background = DOMutil.getDOMElement('div', this.DOMelements.backgrounds, this.dom.lineContainer);
    background.className = 'vis-timeline-chart-background';

    background.style.width = width + 'px';
    background.style.height = height + 'px';
    background.style.top = y + 'px';

  }
}

module.exports = DrawBackground;