var util = require('../../../util');
const DOMutil = require('../../../DOMutil');
const Bars = require('../graph2d_types/bar');
const Lines = require('../graph2d_types/line');
const Points = require('../graph2d_types/points');
const Legend = require('../Legend');
const LineGraph = require('../LineGraph');
const TimelineChartDataAxis = require('./TimelineChartDataAxis');


var UNGROUPED = '__ungrouped__'; // reserved group id for ungrouped items
class TimelineChartLineGraph extends LineGraph {
  constructor(body, options) {
    super(body, options);

    this.options = util.extend({}, this.defaultOptions);
  }

  _create() {
    var frame = document.createElement('div');
    frame.className = 'vis-line-graph';
    this.dom.frame = frame;

    // create svg element for graph drawing.
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.style.position = 'relative';
    this.svg.style.height = ('' + this.options.graphHeight).replace('px', '') + 'px';
    this.svg.style.display = 'block';
    frame.appendChild(this.svg);

    // data axis
    this.options.dataAxis.orientation = 'left';
    this.yAxisLeft = new TimelineChartDataAxis(this.body, this.options.dataAxis, this.svg, this.options.groups);

    this.options.dataAxis.orientation = 'right';
    this.yAxisRight = new TimelineChartDataAxis(this.body, this.options.dataAxis, this.svg, this.options.groups);
    delete this.options.dataAxis.orientation;

    // legends
    this.legendLeft = new Legend(this.body, this.options.legend, 'left', this.options.groups);
    this.legendRight = new Legend(this.body, this.options.legend, 'right', this.options.groups);

    this.show();
  }

  _updateGraph () {
    // reset the svg elements
    DOMutil.prepareElements(this.svgElements);
    if (this.props.width != 0 && this.itemsData != null) {
      var group, i;
      var groupRanges = {};
      var changeCalled = false;
      // this is the range of the SVG canvas
      var minDate = this.body.util.toGlobalTime(-this.body.domProps.root.width);
      var maxDate = this.body.util.toGlobalTime(2 * this.body.domProps.root.width);

      // getting group Ids
      var groupIds = this._getSortedGroupIds();
      if (groupIds.length > 0) {
        var groupsData = {};

        // fill groups data, this only loads the data we require based on the timewindow
        this._getRelevantData(groupIds, groupsData, minDate, maxDate);

        // apply sampling, if disabled, it will pass through this function.
        this._applySampling(groupIds, groupsData);

        // we transform the X coordinates to detect collisions
        for (i = 0; i < groupIds.length; i++) {
          this._convertXcoordinates(groupsData[groupIds[i]]);
        }

        // now all needed data has been collected we start the processing.
        this._getYRanges(groupIds, groupsData, groupRanges);

        // update the Y axis first, we use this data to draw at the correct Y points
        changeCalled = this._updateYAxis(groupIds, groupRanges);

        //  at changeCalled, abort this update cycle as the graph needs another update with new Width input from the Redraw container.
        //  Cleanup SVG elements on abort.
        if (changeCalled == true) {
          DOMutil.cleanupElements(this.svgElements);
          this.abortedGraphUpdate = true;
          return true;
        }
        this.abortedGraphUpdate = false;

        // With the yAxis scaled correctly, use this to get the Y values of the points.
        var below = undefined;
        var previousY = 0;
        var actualY = 0;
        for (i = 0; i < groupIds.length; i++) {
          group = this.groups[groupIds[i]];
          if (this.options.stack === true && (this.options.style === 'line' || this.options.style === 'trend')) {
            if (group.options.excludeFromStacking == undefined || !group.options.excludeFromStacking) {
              if (below != undefined) {
                this._stack(groupsData[group.id], groupsData[below.id]);
                if (group.options.shaded.enabled == true && group.options.shaded.orientation !== "group"){
                  if (group.options.shaded.orientation == "top" && below.options.shaded.orientation !== "group"){
                    below.options.shaded.orientation="group";
                    below.options.shaded.groupId=group.id;
                  } else {
                    group.options.shaded.orientation="group";
                    group.options.shaded.groupId=below.id;
                  }
                }
              }
              below = group;
            }
          }
          previousY = actualY;
          actualY += group.group.rowHeightId[`tl-groups_${group.id}`];
          this._convertYcoordinates(groupsData[groupIds[i]], group, actualY, previousY);
        }

        //Precalculate paths and draw shading if appropriate. This will make sure the shading is always behind any lines.
        var paths = {};
        for (i = 0; i < groupIds.length; i++) {
          group = this.groups[groupIds[i]];
          if ((group.options.style === 'line' || group.options.style === 'trend') && group.options.shaded.enabled == true) {
            var dataset = groupsData[groupIds[i]];
            if (dataset == null || dataset.length == 0) {
              continue;
            }
            if (!paths.hasOwnProperty(groupIds[i])) {
              paths[groupIds[i]] = Lines.calcPath(dataset, group);
            }
            if (group.options.shaded.orientation === "group") {
              var subGroupId = group.options.shaded.groupId;
              if (groupIds.indexOf(subGroupId) === -1) {
                console.log(group.id + ": Unknown shading group target given:" + subGroupId);
                continue;
              }
              if (!paths.hasOwnProperty(subGroupId)) {
                paths[subGroupId] = Lines.calcPath(groupsData[subGroupId], this.groups[subGroupId]);
              }
              Lines.drawShading(paths[groupIds[i]], group, paths[subGroupId], this.framework);
            }
            else {
              Lines.drawShading(paths[groupIds[i]], group, undefined, this.framework);
            }
          }
        }

        // draw the groups, calculating paths if still necessary.
        Bars.draw(groupIds, groupsData, this.framework);
        const callbackFunction = (visEventName, event, element, data) => {
          this.body.emitter.emit(visEventName, { data, event, element });
        }
        const groupsDataFunction = (groupData, groupId) => {
          if (!paths.hasOwnProperty(groupId)) {
            paths[groupId] = Lines.calcPath(groupData, group);
          }

          const itemData = groupData[0];
          if (itemData && itemData.styleLine) group.style = itemData.styleLine;

          const line = Lines.draw(paths[groupId], group, this.framework);

          if (group.group.type === 'line' || group.group.type === 'trend') {
            DOMutil.attachEvents(line, 'mouseenter', groupsData[groupId], (event, element, data) => callbackFunction('itemmouseenter', event, element, data));
            DOMutil.attachEvents(line, 'mouseout', groupsData[groupId], (event, element, data) => callbackFunction('itemmouseout', event, element, data));
            DOMutil.attachEvents(line, 'click', groupsData[groupId], (event, element, data) => callbackFunction('itemclick', event, element, data));
          }
        }
        for (i = 0; i < groupIds.length; i++) {
          group = this.groups[groupIds[i]];
          if (groupsData[groupIds[i]].length > 0) {
            switch (group.options.style) {
              case "line":
              case "trend": {
                if (group.id.indexOf("trend") > -1) {
                  for (var j = 1; j < 3; j++) {
                    const groupData = groupsData[groupIds[i]].filter(x => x.index == j);
                    groupsDataFunction(groupData, groupIds[i])
                    delete paths[groupIds[i]];
                  }
                } else {
                  groupsDataFunction(groupsData[groupIds[i]], groupIds[i])
                }
              }
              //explicit no break;
              case "point":
              //explicit no break;
              case "points":
                if (group.options.style == "point" || group.options.style == "points" || group.options.drawPoints.enabled == true) {
                  const points = Points.draw(groupsData[groupIds[i]], group, this.framework);
                  DOMutil.attachEvents(points, 'mouseenter', groupsData[groupIds[i]], (event, element, data) => callbackFunction('itemmouseenter', event, element, data));
                  DOMutil.attachEvents(points, 'mouseout', groupsData[groupIds[i]], (event, element, data) => callbackFunction('itemmouseout', event, element, data));
                  DOMutil.attachEvents(points, 'click', groupsData[groupIds[i]], (event, element, data) => callbackFunction('itemmclick', event, element, data));
                }
                break;
              case "bar":
              // bar needs to be drawn enmasse
              //explicit no break
              default:
              //do nothing...
            }
          }
        }
      }
    }

    // cleanup unused svg elements
    DOMutil.cleanupElements(this.svgElements);
    return false;
  }

  setOptions(options) {
    if (options) {
      var fields = ['events', 'height', 'graphHeight', 'style', 'dataAxis', 'groups'];
      if (options.graphHeight === undefined && options.height !== undefined) {
        this.updateSVGheight = true;
        this.updateSVGheightOnResize = true;
      }
      else if (this.body.domProps.centerContainer.height !== undefined && options.graphHeight !== undefined) {
        if (parseInt((options.graphHeight + '').replace("px", '')) < this.body.domProps.centerContainer.height) {
          this.updateSVGheight = true;
        }
      }
      util.selectiveDeepExtend(fields, this.options, options);
      util.mergeOptions(this.options, options, 'interpolation');
      util.mergeOptions(this.options, options, 'drawPoints');
      util.mergeOptions(this.options, options, 'shaded');
      util.mergeOptions(this.options, options, 'legend');

      if (this.yAxisLeft) {
        if (options.dataAxis !== undefined) {
          this.yAxisLeft.setOptions(this.options.dataAxis);
          this.yAxisRight.setOptions(this.options.dataAxis);
        }
      }

      if (this.legendLeft) {
        if (options.legend !== undefined) {
          this.legendLeft.setOptions(this.options.legend);
          this.legendRight.setOptions(this.options.legend);
        }
      }

      if (this.groups.hasOwnProperty(UNGROUPED)) {
        this.groups[UNGROUPED].setOptions(options);
      }
    }

    // this is used to redraw the graph if the visibility of the groups is changed.
    if (this.dom.frame) { //not on initial run?
      this.forceGraphUpdate=true;
      this.body.emitter.emit("_change",{queue: true});
    }
  }

  _updateGroups(groupsContent) {
    this.groupsData.forEach(group => {
      this._updateGroup(group, group.id);
      this.groups[group.id].setItems(groupsContent[group.id]);
    });
  }

  _convertYcoordinates(datapoints, group, actualY, previousY) {

    if (group.group.type === 'arrow-avg') {
      this._convertAvgYcoordinates(datapoints, group, actualY, previousY)
    } else {
      this._convertPointsYcoordinates(datapoints, group, actualY, previousY)
    }
  }

  _convertPointsYcoordinates(datapoints, group, actualY, previousY) {
    var axis = this.yAxisLeft;
    if (group.options.yAxisOrientation == 'right') {
      axis = this.yAxisRight;
    }

    const offset = 10;
    const baseScreenY = (actualY - previousY) - offset;
    const listOfValues = datapoints.map(d => d.y);
    const range = {
      max: Math.max(...listOfValues),
      min: Math.min(...listOfValues)
    };

    for (var i = 0; i < datapoints.length; i++) {
      let convertedValue = 0;
      if (range.min === range.max) {
        convertedValue = Math.round(baseScreenY * 50 / 100);
      } else {
        convertedValue = Math.round(axis.convertValue(datapoints[i].y, range, baseScreenY));
      }
      datapoints[i].screen_y = (actualY - (offset / 2)) - convertedValue;
    }
    if (range.min === range.max) {
      group.zeroPosition = (actualY - (offset / 2)) - Math.round(baseScreenY * 50 / 100);
    } else {
      group.zeroPosition = (actualY - (offset / 2)) - Math.round(axis.convertValue(range.min, range, baseScreenY));
    }
  }

  _convertAvgYcoordinates(datapoints, group, actualY, previousY) {
    var axis = this.yAxisLeft;
    if (group.options.yAxisOrientation == 'right') {
      axis = this.yAxisRight;
    }

    const offset = 10;
    const baseScreenY = (actualY - previousY) - offset;
    const listOfMaxValues = datapoints.map(d => d.maxValue);
    const listOfMinValues = datapoints.map(d => d.minValue);
    const range = {
      max: Math.max(...listOfMaxValues),
      min: Math.min(...listOfMinValues)
    };

    for (var i = 0; i < datapoints.length; i++) {
      let convertedValue = 0;
      const maxValue = datapoints[i].maxValue;
      const minValue = datapoints[i].minValue;
      const difference = maxValue - minValue;
      convertedValue = Math.round(baseScreenY * 50 / 100);
      datapoints[i].screen_y = (actualY - (offset / 2)) - convertedValue;

      const diffPercent = difference * 100 / (range.max - range.min);
      const proportionalSize = (diffPercent * baseScreenY / 100) - offset;
      datapoints[i].prop.size = proportionalSize <= 0 ? 0 : proportionalSize;
    }
  }

  _updateAllGroupData() {
      if (this.itemsData != null) {
    //Update legendas, style and axis
    const groupsContent = this._generateGroupContents(this.itemsData);
    this._updateGroups(groupsContent);
    this._calculateHeights();
    this.forceGraphUpdate = true;
    this.body.emitter.emit("_change",{queue: true});
  }
  }

  _calculateHeights() {
    let totalHeight = 0;

    this.groupsData.forEach(d => {
      if (d.rowHeightId) {
        totalHeight += d.rowHeightId[d.className];
      }
    });

    this.options.height = totalHeight + 1;
    this.options.graphHeight = totalHeight + 1;
    this.options.legend = { enabled: false }
  }
}

module.exports = TimelineChartLineGraph;