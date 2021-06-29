import { TIMELINE_CHART_PADDINGS as TimelineChartPaddings } from '../../../Constants';

class DrawLabels {
  constructor(redrawLabel, props, options) {
    this._redrawLabel = redrawLabel;
    this.props = props;
    this.options = options;
  }

  renderLabel(y, orientation, group, previousY) {
    let labelClass = 'vis-y-axis vis-timeline-chart-y-axis';

    switch(group.group.type) {
      case 'arrow-avg':
        this._renderArrowAvgLabel(y, previousY, orientation, labelClass, group);
        break;
      default:
        this._renderLineLabel(y, previousY, orientation, labelClass, group);
        break;
    }
  }

  _renderArrowAvgLabel(y, previousY, orientation, labelClass, group) {
    if (group.itemsData && group.itemsData.length > 0) {
      const listOfMaxValues = group.itemsData.map(item => item.maxValue);
      const listOfMinValues = group.itemsData.map(item => item.minValue);
      const maxValue = Math.max(...listOfMaxValues);
      const avgValue = group.itemsData[0] && group.itemsData[0].avgValue ? group.itemsData[0].avgValue : undefined;
      const minValue = Math.min(...listOfMinValues);

      const { topLabelY, middleLabelY, bottomLabelY } = this._getSupportLabels(y, previousY);

      this._redrawLabel(y - topLabelY, maxValue, orientation, labelClass, this.props.minorCharHeight);
      this._redrawLabel(y - middleLabelY, avgValue, orientation, labelClass, this.props.minorCharHeight);
      this._redrawLabel(y - bottomLabelY, minValue, orientation, labelClass, this.props.minorCharHeight);
    }
  }

  _renderCircleLabel(y, previousY, orientation, labelClass, group) {
    let values = group.itemsData.map(item => item.y);

    if (values.length > 0) {
      const maxValue = Math.max(...values);
      const minValue = Math.min(...values);
      const { topLabelY, middleLabelY, bottomLabelY } = this._getSupportLabels(y, previousY);

      if (maxValue === minValue) {
        this._redrawLabel(y - middleLabelY, maxValue, orientation, labelClass, this.props.minorCharHeight);
      } else {
        this._redrawLabel(y - topLabelY, maxValue, orientation, labelClass, this.props.minorCharHeight);
        this._redrawLabel(y - bottomLabelY, minValue, orientation, labelClass, this.props.minorCharHeight);
      }
    }
  }

  _renderLineLabel(y, previousY, orientation, labelClass, group) {
    let values = group.itemsData.map(item => item.y);
    const avgValue = group.itemsData[0] && group.itemsData[0].avgValue ? group.itemsData[0].avgValue : undefined;

    if (values.length > 0) {
      const maxValue = Math.max(...values);
      const minValue = Math.min(...values);
      const { topLabelY, middleLabelY, bottomLabelY } = this._getSupportLabels(y, previousY, this.options.fontSize);

      if (maxValue === minValue || avgValue) {
        const label = avgValue !== undefined ? avgValue : maxValue;
        this._redrawLabel(y - middleLabelY, label, orientation, labelClass, this.props.minorCharHeight);
      } else {
        this._redrawLabel(y - topLabelY, maxValue, orientation, labelClass, this.props.minorCharHeight);
        this._redrawLabel(y - bottomLabelY, minValue, orientation, labelClass, this.props.minorCharHeight);
      }
    }
  }

  _getSupportLabels(y, previousY) {
    const size = y - previousY;
    const labelOffsetY = this.options.labelOffsetY * -1;
    const topLabelY = (size - (size * TimelineChartPaddings.top)) + labelOffsetY;
    const middleLabelY = (size * 50 / 100) + labelOffsetY;
    const bottomLabelY = (size * TimelineChartPaddings.bottom) + labelOffsetY;

    return {topLabelY, middleLabelY, bottomLabelY};
  }
}

module.exports = DrawLabels;