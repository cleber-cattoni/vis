var moment = require('../module/moment');
var util = require('../util');
var DataSet = require('../DataSet');
var DataView = require('../DataView');
var Range = require('./Range');
var Core = require('./Core');
var TimeAxis = require('./component/TimeAxis');
var CurrentTime = require('./component/CurrentTime');
const TimelineChartLineGraph = require('./component/timeline-chart/TimelineChartLineGraph');
const { default: Validator } = require('../shared/Validator');
const allOptions = require('./optionsTimelineChart').allOptions;
const configureOptions = require('./optionsTimelineChart').configureOptions;

class TimelineChart extends Core {
  constructor(container, items, groups, options) {
    super();
    // if the third element is options, the forth is groups (optionally);
    if (!(Array.isArray(groups) || groups instanceof DataSet || groups instanceof DataView) && groups instanceof Object) {
      var forthArgument = options;
      options = groups;
      groups = forthArgument;
    }

    var groupNow = null;
    var me = this;
    this.rootClass = `vis-timeline-chart`;
    this.defaultOptions = { 
      start: null,
      end:   null,

      autoResize: true,

      orientation: {
        axis: 'bottom',   // axis orientation: 'bottom', 'top', or 'both'
        item: 'bottom'    // not relevant for Graph2d
      },

      moment: moment,

      width: null,
      height: null,
      maxHeight: null,
      minHeight: null
    };
    this.options = util.deepExtend({}, this.defaultOptions);

    // Create the DOM, props, and emitter
    this._create(container);

    // all components listed here will be repainted automatically
    this.components = [];

    this.body = {
      dom: this.dom,
      domProps: this.props,
      emitter: {
        on: this.on.bind(this),
        off: this.off.bind(this),
        emit: this.emit.bind(this)
      },
      hiddenDates: [],
      util: {
        toScreen: me._toScreen.bind(me),
        toGlobalScreen: me._toGlobalScreen.bind(me), // this refers to the root.width
        toTime: me._toTime.bind(me),
        toGlobalTime : me._toGlobalTime.bind(me)
      }
    };

    // range
    this.range = new Range(this.body);
    this.components.push(this.range);
    this.body.range = this.range;

    // time axis
    this.timeAxis = new TimeAxis(this.body);
    this.components.push(this.timeAxis);
    //this.body.util.snap = this.timeAxis.snap.bind(this.timeAxis);

    // current time bar
    this.currentTime = new CurrentTime(this.body);
    this.components.push(this.currentTime);

    // item set
    this.linegraph = new TimelineChartLineGraph(this.body);
    this.components.push(this.linegraph);

    this.itemsData = null;      // DataSet
    this.groupsData = null;     // DataSet


    this.on('tap', function (event) {
      me.emit('click', me.getEventProperties(event));
    });
    this.on('doubletap', function (event) {
      const eventProperties = me.getEventProperties(event);
      eventProperties.snappedTime = this.body.util.toTime(event.changedPointers[0].offsetX - this.props.center.width);
      eventProperties.group = (this.pointToRow(event.changedPointers[0].offsetY) || {}).value;
      me.emit('doubleClick', eventProperties);
    });
    this.dom.root.oncontextmenu = function (event) {
      me.emit('contextmenu', me.getEventProperties(event));
    };
    this.dom.root.onmousemove = function (event) {
      const eventProperties = me.getEventProperties(event);
      const groupId = (me.pointToRow(event.offsetY) || {}).value;
      eventProperties.data = { id: groupId };

      if (groupNow != groupId) {
        if (groupNow) {
          const eventPropertiesOld = _.clone(eventProperties);
          eventPropertiesOld.data = { id: groupNow };
          me.emit('linemouseout', eventPropertiesOld);
        }

        if (groupId) {
          groupNow = groupId;
          me.emit('linemouseenter', eventProperties);
        }
      }
    };
    this.dom.root.onmouseleave = function (event) {
      const eventProperties = me.getEventProperties(event);
      eventProperties.data = { id: groupNow };
      groupNow = null;
      me.emit('linemouseout', eventProperties);
    };

    // apply options
    if (options) {
      this.setOptions(options);
    }

    // IMPORTANT: THIS HAPPENS BEFORE SET ITEMS!
    if (groups) {
      this.setGroups(groups);
    }

    // create itemset
    if (items) {
      this.setItems(items);
    }

    // draw for the first time
    this._redraw();
  }

  pointToRow(y) {
    let totalHeight = 0;
    let row = null;
    this.groupsData.forEach(d => {
      if (!d.rowHeightId) return;
      const maxY = totalHeight + d.rowHeightId[d.className];
      if (y > totalHeight && y < maxY) {
        row = d;
      }
      totalHeight = maxY;
    });
    return row;
  }

  setGroups(groups) {
    // convert to type DataSet when needed
    var newDataSet;
    if (!groups) {
      newDataSet = null;
    }
    else if (groups instanceof DataSet || groups instanceof DataView) {
      newDataSet = groups;
    }
    else {
      // turn an array into a dataset
      newDataSet = new DataSet(groups);
    }

    this.groupsData = newDataSet;
    this.linegraph.setGroups(newDataSet);
  }

  setItems(items) {
    var initialLoad = (this.itemsData == null);

    // convert to type DataSet when needed
    var newDataSet;
    if (!items) {
      newDataSet = null;
    }
    else if (items instanceof DataSet || items instanceof DataView) {
      newDataSet = items;
    }
    else {
      // turn an array into a dataset
      newDataSet = new DataSet(items, {
        type: {
          start: 'Date',
          end: 'Date'
        }
      });
    }

    // set items
    this.itemsData = newDataSet;
    this.linegraph && this.linegraph.setItems(newDataSet);

    if (initialLoad) {
      if (this.options.start != undefined || this.options.end != undefined) {
        var start = this.options.start != undefined ? this.options.start : null;
        var end   = this.options.end != undefined   ? this.options.end : null;
        this.setWindow(start, end, {animation: false});
      }
      else {
        this.fit({animation: false});
      }
    }
  }

  setOptions(options) {
    // validate options
    let errorFound = Validator.validate(options, allOptions);
    if (errorFound === true) {
      console.log('%cErrors have been found in the supplied options object.', printStyle);
    }

    Core.prototype.setOptions.call(this, options);
  };

  /**
  * Load a configurator
  * @return {Object}
  * @private
  */
  _createConfigurator() {
    return new Configurator(this, this.dom.container, configureOptions);
  };

  getDataRange() {
    var min = null;
    var max = null;

    // calculate min from start filed
    for (var groupId in this.linegraph.groups) {
      if (this.linegraph.groups.hasOwnProperty(groupId)) {
        if (this.linegraph.groups[groupId].visible == true) {
          for (var i = 0; i < this.linegraph.groups[groupId].itemsData.length; i++) {
            var item = this.linegraph.groups[groupId].itemsData[i];
            var value = util.convert(item.x, 'Date').valueOf();
            min = min == null ? value : min > value ? value : min;
            max = max == null ? value : max < value ? value : max;
          }
        }
      }
    }

    return {
      min: (min != null) ? new Date(min) : null,
      max: (max != null) ? new Date(max) : null
    };
  }
}

module.exports = TimelineChart;