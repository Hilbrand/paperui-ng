import './chart.js';

const Chart = window.Chart;

var helpers = Chart.helpers;

helpers.cancelAnimFrame = (function() {
	if (typeof window !== 'undefined') {
		return window.cancelAnimationFrame ||
			window.webkitCancelAnimationFrame ||
			window.mozCancelAnimationFrame ||
			window.oCancelAnimationFrame ||
			window.msCancelAnimationFrame ||
			function(id) {
				return window.clearTimeout(id);
			};
	}
}());

helpers.startFrameRefreshTimer = function(context, func) {
	if (!context.frameRequestID) {
		var frameRefresh = function() {
			func();
			context.frameRequestID = helpers.requestAnimFrame.call(window, frameRefresh);
		};
		context.frameRequestID = helpers.requestAnimFrame.call(window, frameRefresh);
	}
};

helpers.stopFrameRefreshTimer = function(context) {
	var frameRequestID = context.frameRequestID;

	if (frameRequestID) {
		helpers.cancelAnimFrame.call(window, frameRequestID);
		delete context.frameRequestID;
	}
};

var scaleService = Chart.scaleService;
var TimeScale = scaleService.constructors['time'];

var valueOrDefault = helpers.valueOrDefault;

// Ported from Chart.js 2.7.3 1cd0469.
function momentify(value, options) {
	var parser = options.parser;
	var format = options.parser || options.format;

	if (typeof parser === 'function') {
		return parser(value);
	}

	if (typeof value === 'string' && typeof format === 'string') {
		return value;
	}

	if (value.isValid()) {
		return value;
	}

	// Labels are in an incompatible moment format and no `parser` has been provided.
	// The user might still use the deprecated `format` option to convert his inputs.
	if (typeof format === 'function') {
		return format(value);
	}

	return value;
}

// Ported from Chart.js 2.7.3 1cd0469.
function parse(input, scale) {
	if (helpers.isNullOrUndef(input)) {
		return null;
	}

	var options = scale.options.time;
	var value = momentify(scale.getRightValue(input), options);
	if (!value.isValid()) {
		return null;
	}

	if (options.round) {
		value.startOf(options.round);
	}

	return value.valueOf();
}

function resolveOption(scale, key) {
	var realtimeOpts = scale.options.realtime;
	var streamingOpts = scale.chart.options.plugins.streaming;
	return valueOrDefault(realtimeOpts[key], streamingOpts[key]);
}

var datasetPropertyKeys = [
	'pointBackgroundColor',
	'pointBorderColor',
	'pointBorderWidth',
	'pointRadius',
	'pointRotation',
	'pointStyle',
	'pointHitRadius',
	'pointHoverBackgroundColor',
	'pointHoverBorderColor',
	'pointHoverBorderWidth',
	'pointHoverRadius',
	'backgroundColor',
	'borderColor',
	'borderSkipped',
	'borderWidth',
	'hoverBackgroundColor',
	'hoverBorderColor',
	'hoverBorderWidth',
	'hoverRadius',
	'hitRadius',
	'radius'
];

function refreshData(scale) {
	var chart = scale.chart;
	var id = scale.id;
	var duration = resolveOption(scale, 'duration');
	var delay = resolveOption(scale, 'delay');
	var ttl = resolveOption(scale, 'ttl');
	var pause = resolveOption(scale, 'pause');
	var onRefresh = resolveOption(scale, 'onRefresh');
	var max = scale.max;
	var min = Date.now() - (isNaN(ttl) ? duration + delay : ttl);
	var meta, data, length, i, start, count, removalRange;

	if (onRefresh) {
		onRefresh(chart);
	}

	// Remove old data
	chart.data.datasets.forEach(function(dataset, datasetIndex) {
		meta = chart.getDatasetMeta(datasetIndex);
		if (id === meta.xAxisID || id === meta.yAxisID) {
			data = dataset.data;
			length = data.length;

			if (pause) {
				// If the scale is paused, preserve the visible data points
				for (i = 0; i < length; ++i) {
					if (!(scale._getTimeForIndex(i, datasetIndex) < max)) {
						break;
					}
				}
				start = i + 2;
			} else {
				start = 0;
			}

			for (i = start; i < length; ++i) {
				if (!(scale._getTimeForIndex(i, datasetIndex) <= min)) {
					break;
				}
			}
			count = i - start;
			if (isNaN(ttl)) {
				// Keep the last two data points outside the range not to affect the existing bezier curve
				count = Math.max(count - 2, 0);
			}

			data.splice(start, count);
			datasetPropertyKeys.forEach(function(key) {
				if (dataset.hasOwnProperty(key) && helpers.isArray(dataset[key])) {
					dataset[key].splice(start, count);
				}
			});
			if (typeof data[0] !== 'object') {
				removalRange = {
					start: start,
					count: count
				};
			}
		}
	});
	if (removalRange) {
		chart.data.labels.splice(removalRange.start, removalRange.count);
	}

	chart.update({
		preservation: true
	});
}

function stopDataRefreshTimer(scale) {
	var realtime = scale.realtime;
	var refreshTimerID = realtime.refreshTimerID;

	if (refreshTimerID) {
		clearInterval(refreshTimerID);
		delete realtime.refreshTimerID;
		delete realtime.refreshInterval;
	}
}

function startDataRefreshTimer(scale) {
	var realtime = scale.realtime;
	var interval = resolveOption(scale, 'refresh');

	realtime.refreshTimerID = setInterval(function() {
		var newInterval = resolveOption(scale, 'refresh');

		refreshData(scale);
		if (realtime.refreshInterval !== newInterval && !isNaN(newInterval)) {
			stopDataRefreshTimer(scale);
			startDataRefreshTimer(scale);
		}
	}, interval);
	realtime.refreshInterval = interval;
}

var transitionKeys = {
	x: {
		data: ['x', 'controlPointPreviousX', 'controlPointNextX'],
		dataset: ['x'],
		tooltip: ['x', 'caretX']
	},
	y: {
		data: ['y', 'controlPointPreviousY', 'controlPointNextY'],
		dataset: ['y'],
		tooltip: ['y', 'caretY']
	}
};

function transition(element, keys, translate) {
	var start = element._start || {};
	var view = element._view || {};
	var model = element._model || {};
	var i, ilen;

	for (i = 0, ilen = keys.length; i < ilen; ++i) {
		var key = keys[i];
		if (start.hasOwnProperty(key)) {
			start[key] -= translate;
		}
		if (view.hasOwnProperty(key) && view !== start) {
			view[key] -= translate;
		}
		if (model.hasOwnProperty(key) && model !== view) {
			model[key] -= translate;
		}
	}
}

function scroll(scale) {
	var chart = scale.chart;
	var realtime = scale.realtime;
	var duration = resolveOption(scale, 'duration');
	var delay = resolveOption(scale, 'delay');
	var id = scale.id;
	var tooltip = chart.tooltip;
	var activeTooltip = tooltip._active;
	var now = Date.now();
	var length, keys, offset, meta, elements, i, ilen;

	if (scale.isHorizontal()) {
		length = scale.width;
		keys = transitionKeys.x;
	} else {
		length = scale.height;
		keys = transitionKeys.y;
	}
	offset = length * (now - realtime.head) / duration;

	if (scale.options.ticks.reverse) {
		offset = -offset;
	}

	// Shift all the elements leftward or upward
	helpers.each(chart.data.datasets, function(dataset, datasetIndex) {
		meta = chart.getDatasetMeta(datasetIndex);
		if (id === meta.xAxisID || id === meta.yAxisID) {
			elements = meta.data || [];

			for (i = 0, ilen = elements.length; i < ilen; ++i) {
				transition(elements[i], keys.data, offset);
			}

			if (meta.dataset) {
				transition(meta.dataset, keys.dataset, offset);
			}
		}
	});

	// Shift tooltip leftward or upward
	if (activeTooltip && activeTooltip[0]) {
		meta = chart.getDatasetMeta(activeTooltip[0]._datasetIndex);
		if (id === meta.xAxisID || id === meta.yAxisID) {
			transition(tooltip, keys.tooltip, offset);
		}
	}

	scale.max = scale._table[1].time = now - delay;
	scale.min = scale._table[0].time = scale.max - duration;

	realtime.head = now;
}

var defaultConfig = {
	position: 'bottom',
	distribution: 'linear',
	bounds: 'data',

	time: {
		parser: false, // false == a pattern string from http://momentjs.com/docs/#/parsing/string-format/ or a custom callback that converts its argument to a moment
		format: false, // DEPRECATED false == date objects, moment object, callback or a pattern string from http://momentjs.com/docs/#/parsing/string-format/
		unit: false, // false == automatic or override with week, month, year, etc.
		round: false, // none, or override with week, month, year, etc.
		displayFormat: false, // DEPRECATED
		isoWeekday: false, // override week start day - see http://momentjs.com/docs/#/get-set/iso-weekday/
		minUnit: 'millisecond',

		// defaults to unit's corresponding unitFormat below or override using pattern string from http://momentjs.com/docs/#/displaying/format/
		displayFormats: {
			millisecond: 'h:mm:ss.SSS a', // 11:20:01.123 AM,
			second: 'h:mm:ss a', // 11:20:01 AM
			minute: 'h:mm a', // 11:20 AM
			hour: 'hA', // 5PM
			day: 'MMM D', // Sep 4
			week: 'll', // Week 46, or maybe "[W]WW - YYYY" ?
			month: 'MMM YYYY', // Sept 2015
			quarter: '[Q]Q - YYYY', // Q3
			year: 'YYYY' // 2015
		},
	},
	realtime: {},
	ticks: {
		autoSkip: false,
		source: 'auto',
		major: {
			enabled: true
		}
	}
};

var RealTimeScale = TimeScale.extend({
	initialize: function() {
		var me = this;

		TimeScale.prototype.initialize.apply(me, arguments);

		me.realtime = me.realtime || {};

		startDataRefreshTimer(me);
	},

	update: function() {
		var me = this;
		var realtime = me.realtime;

		if (resolveOption(me, 'pause')) {
			helpers.stopFrameRefreshTimer(realtime);
		} else {
			helpers.startFrameRefreshTimer(realtime, function() {
				scroll(me);
			});
			realtime.head = Date.now();
		}

		return TimeScale.prototype.update.apply(me, arguments);
	},

	buildTicks: function() {
		var me = this;
		var options = me.options;

		var timeOpts = options.time;
		var majorTicksOpts = options.ticks.major;
		var duration = resolveOption(me, 'duration');
		var delay = resolveOption(me, 'delay');
		var refresh = resolveOption(me, 'refresh');
		var bounds = options.bounds;
		var distribution = options.distribution;
		var offset = options.offset;
		var minTime = timeOpts.min;
		var maxTime = timeOpts.max;
		var majorEnabled = majorTicksOpts.enabled;
		var max = me.realtime.head - delay;
		var min = max - duration;
		var maxArray = [max + refresh, max];
		var ticks;

		options.bounds = undefined;
		options.distribution = 'linear';
		options.offset = false;
		timeOpts.min = -1e15;
		timeOpts.max = 1e15;
		majorTicksOpts.enabled = true;

		Object.defineProperty(me, 'min', {
			get: function() {
				return min;
			},
			set: helpers.noop
		});
		Object.defineProperty(me, 'max', {
			get: function() {
				return maxArray.shift();
			},
			set: helpers.noop
		});

		ticks = TimeScale.prototype.buildTicks.apply(me, arguments);

		delete me.min;
		delete me.max;

		me.min = min;
		me.max = max;
		options.bounds = bounds;
		options.distribution = distribution;
		options.offset = offset;
		timeOpts.min = minTime;
		timeOpts.max = maxTime;
		majorTicksOpts.enabled = majorEnabled;
		me._table = [{time: min, pos: 0}, {time: max, pos: 1}];

		return ticks;
	},

	fit: function() {
		var me = this;
		var options = me.options;

		TimeScale.prototype.fit.apply(me, arguments);

		if (options.ticks.display && options.display && me.isHorizontal()) {
			me.paddingLeft = 3;
			me.paddingRight = 3;
			me.handleMargins();
		}
	},

	draw: function(chartArea) {
		var me = this;
		var chart = me.chart;

		var context = me.ctx;
		var	clipArea = me.isHorizontal() ?
			{
				left: chartArea.left,
				top: 0,
				right: chartArea.right,
				bottom: chart.height
			} : {
				left: 0,
				top: chartArea.top,
				right: chart.width,
				bottom: chartArea.bottom
			};

		// Clip and draw the scale
		helpers.canvas.clipArea(context, clipArea);
		TimeScale.prototype.draw.apply(me, arguments);
		helpers.canvas.unclipArea(context);
	},

	destroy: function() {
		var me = this;

		helpers.stopFrameRefreshTimer(me.realtime);
		stopDataRefreshTimer(me);
	},

	/*
	 * @private
	 */
	_getTimeForIndex: function(index, datasetIndex) {
		var me = this;
		var timestamps = me._timestamps;
		var time = timestamps.datasets[datasetIndex][index];
		var value;

		if (helpers.isNullOrUndef(time)) {
			value = me.chart.data.datasets[datasetIndex].data[index];
			if (helpers.isObject(value)) {
				time = parse(me.getRightValue(value), me);
			} else {
				time = parse(timestamps.labels[index], me);
			}
		}

		return time;
	}
});

scaleService.registerScaleType('realtime', RealTimeScale, defaultConfig);

Chart.defaults.global.plugins.streaming = {
	duration: 10000,
	delay: 0,
	frameRate: 30,
	refresh: 1000,
	onRefresh: null,
	pause: false,
	ttl: undefined
};

/**
 * Update the chart data keeping the current animation but suppressing a new one
 * @param chart {Chart} chart to update
 */
function updateChartData(chart) {
	var animationOpts = chart.options.animation;
	var datasets = chart.data.datasets;
	var newControllers = chart.buildOrUpdateControllers();
	var lastMouseEvent = chart.streaming.lastMouseEvent;

	datasets.forEach(function(dataset, datasetIndex) {
		chart.getDatasetMeta(datasetIndex).controller.buildOrUpdateElements();
	});
	chart.updateLayout();
	if (animationOpts && animationOpts.duration) {
		helpers.each(newControllers, function(controller) {
			controller.reset();
		});
	}
	chart.updateDatasets();

	if (chart.animating) {
		// If the chart is animating, keep it until the duration is over
		Chart.animationService.animations.forEach(function(animation) {
			if (animation.chart === chart) {
				chart.render({
					duration: (animation.numSteps - animation.currentStep) * 16.66
				});
			}
		});
	} else {
		// If the chart is not animating, make sure that all elements are at the final positions
		datasets.forEach(function(dataset, datasetIndex) {
			chart.getDatasetMeta(datasetIndex).controller.transition(1);
		});
	}

	if (chart.tooltip._active) {
		chart.tooltip.update(true);
	}

	if (lastMouseEvent) {
		chart.eventHandler(lastMouseEvent);
	}
}

var update = Chart.prototype.update;

Chart.prototype.update = function(config) {
	if (config && config.preservation) {
		updateChartData(this);
	} else {
		update.apply(this, arguments);
	}
};

// Draw chart at frameRate
function drawChart(chart) {
	var streaming = chart.streaming;
	var frameRate = chart.options.plugins.streaming.frameRate;
	var frameDuration = 1000 / (Math.max(frameRate, 0) || 30);
	var next = streaming.lastDrawn + frameDuration || 0;
	var now = Date.now();
	var lastMouseEvent = streaming.lastMouseEvent;

	if (next <= now) {
		// Draw only when animation is inactive
		if (!chart.animating && !chart.tooltip._start) {
			chart.draw();
		}
		if (lastMouseEvent) {
			chart.eventHandler(lastMouseEvent);
		}
		streaming.lastDrawn = (next + frameDuration > now) ? next : now;
	}
}

var streamingPlugin = {
	id: 'streaming',

	beforeInit: function(chart) {
		var streaming = chart.streaming = chart.streaming || {};
		var canvas = streaming.canvas = chart.canvas;
		var mouseEventListener = streaming.mouseEventListener = function(event) {
			var pos = helpers.getRelativePosition(event, chart);
			streaming.lastMouseEvent = {
				type: 'mousemove',
				chart: chart,
				native: event,
				x: pos.x,
				y: pos.y
			};
		};

		canvas.addEventListener('mousedown', mouseEventListener);
		canvas.addEventListener('mouseup', mouseEventListener);
	},

	afterInit: function(chart) {
		if (chart.resetZoom) {
			Chart.Zoom.updateResetZoom(chart);
		}
	},

	beforeUpdate: function(chart) {
		var chartOpts = chart.options;
		var scalesOpts = chartOpts.scales;

		if (scalesOpts) {
			scalesOpts.xAxes.concat(scalesOpts.yAxes).forEach(function(scaleOpts) {
				if (scaleOpts.type === 'realtime' || scaleOpts.type === 'time') {
					// Allow Bézier control to be outside the chart
					chartOpts.elements.line.capBezierPoints = false;
				}
			});
		}
		return true;
	},

	afterUpdate: function(chart, options) {
		var streaming = chart.streaming;
		var pause = true;

		// if all scales are paused, stop refreshing frames
		helpers.each(chart.scales, function(scale) {
			if (scale instanceof RealTimeScale) {
				pause &= helpers.valueOrDefault(scale.options.realtime.pause, options.pause);
			}
		});
		if (pause) {
			helpers.stopFrameRefreshTimer(streaming);
		} else {
			helpers.startFrameRefreshTimer(streaming, function() {
				drawChart(chart);
			});
		}
	},

	beforeDatasetDraw: function(chart, args) {
		var meta = args.meta;
		var chartArea = chart.chartArea;
		var clipArea = {
			left: 0,
			top: 0,
			right: chart.width,
			bottom: chart.height
		};
		if (meta.xAxisID && meta.controller.getScaleForId(meta.xAxisID) instanceof RealTimeScale) {
			clipArea.left = chartArea.left;
			clipArea.right = chartArea.right;
		}
		if (meta.yAxisID && meta.controller.getScaleForId(meta.yAxisID) instanceof RealTimeScale) {
			clipArea.top = chartArea.top;
			clipArea.bottom = chartArea.bottom;
		}
		helpers.canvas.clipArea(chart.ctx, clipArea);
		return true;
	},

	afterDatasetDraw: function(chart) {
		helpers.canvas.unclipArea(chart.ctx);
	},

	beforeEvent: function(chart, event) {
		var streaming = chart.streaming;

		if (event.type === 'mousemove') {
			// Save mousemove event for reuse
			streaming.lastMouseEvent = event;
		} else if (event.type === 'mouseout') {
			// Remove mousemove event
			delete streaming.lastMouseEvent;
		}
		return true;
	},

	destroy: function(chart) {
		var streaming = chart.streaming;
		var canvas = streaming.canvas;
		var mouseEventListener = streaming.mouseEventListener;

		helpers.stopFrameRefreshTimer(streaming);

		canvas.removeEventListener('mousedown', mouseEventListener);
		canvas.removeEventListener('mouseup', mouseEventListener);

		helpers.each(chart.scales, function(scale) {
			if (scale instanceof RealTimeScale) {
				scale.destroy();
			}
		});
	}
};

/**
 * Shows a graph for time-resources.
 */
class UITimeGraph extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this.waitForEvent = this.hasAttribute("waitForEvent") ? this.getAttribute("waitForEvent") : null;
        this.pageChangedBound = () => this.ready();
        if (this.waitForEvent) document.addEventListener(this.waitForEvent, this.pageChangedBound);

        try {
            this.maxdata = this.hasAttribute("maxdata") ? parseInt(this.getAttribute("maxdata")) : 20;
        } catch (e) {
            this.maxdata = 20;
        }

        this.color = this.hasAttribute("color") ? this.getAttribute("color") : "rgb(255, 99, 132)";

        this.config = {
            plugins: [streamingPlugin],
            type: 'line',
            data: {
                datasets: [{
                    streaming: { duration: 0, delay: 0 },
                    label: '',
                    backgroundColor: this.color,
                    borderColor: this.color,
                    data: [],
                    fill: false,
                },{
                    streaming: { duration: 1000 * 60, delay: 2000 },
                    label: 'Minute',
                    backgroundColor: this.color,
                    borderColor: this.color,
                    data: [],
                    fill: false,
                }, {
                    streaming: { duration: 1000 * 60 * 60, delay: 1000 * 60 },
                    label: 'Hour',
                    backgroundColor: this.color,
                    borderColor: this.color,
                    data: [],
                    fill: false,
                }, {
                    streaming: { duration: 1000 * 60 * 60 * 24, delay: 1000 * 60 * 60 },
                    label: 'Day',
                    backgroundColor: this.color,
                    borderColor: this.color,
                    data: [],
                    fill: false,
                }, {
                    streaming: { duration: 1000 * 60 * 60 * 24 * 7, delay: 1000 * 60 * 60 * 24 },
                    label: 'Week',
                    backgroundColor: this.color,
                    borderColor: this.color,
                    data: [],
                    fill: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                legend: {
                    onClick: (e, legendItem) => this.show(e, legendItem),
                    labels: {
                        filter: function(item, chart) {
                            return item.text!='';
                        }
                    }
                },
                tooltips: false,
                // events: [],
                title: {
                    display: true,
                    text: this.hasAttribute("label") ? this.getAttribute("label") : 'My First dataset',
                },
                elements: {
                    line: {
                        tension: 0
                    }
                },
                hover: {
                    mode: null
                },
                plugins: {
                    streaming: {            // per-chart option
                        frameRate: 30       // chart is drawn 30 times every second
                    }
                },
                scales: {
                    // xAxes: [{
                    //     display: true,
                    //     scaleLabel: {
                    //         display: true,
                    //         labelString: 'Month'
                    //     },
                    //     ticks: {
                    //         min: 0,
                    //         max: this.maxdata
                    //     }
                    // }],
                    xAxes: [{
                        type: 'realtime',
                        realtime: {
                            duration: 1000 * 60 * 60,
                            delay: 1000,
                            pause: false,
                            ttl: 1000 * 60 * 60 * 24 * 8
                        },
                    }],
                    yAxes: [{
                        display: true,
                        scaleLabel: false,
                        ticks: {
                            min: 0,
                            suggestedMax: 100
                        }
                    }]
                }
            }
        };
    }
    disconnectedCallback() {
        this.canvas = null;
        if (this.waitForEvent) document.removeEventListener(this.waitForEvent, this.pageChangedBound);
    }
    connectedCallback() {
        const root = this.shadowRoot;
        root.innerHTML = `<style>
        :host {
            display: block;
            position: relative;
        }
        canvas{
            -moz-user-select: none;
            -webkit-user-select: none;
            -ms-user-select: none;
        }</style>`;
        // Private API use: ShadowDom style encapsulation workaround
        root.appendChild(Chart.platform._style.cloneNode(true));
        this.canvas = document.createElement("canvas");
        var ctx = this.canvas.getContext('2d');
        this.charts = new Chart(ctx, this.config);
        root.appendChild(this.canvas);
        // this.charts.resize();
        if (!this.waitForEvent) this.ready();
    }

    show(e, legendItem) {
        for (var i=1;i<this.config.data.datasets.length;++i) {
            var dataset = this.config.data.datasets[i];
            dataset.backgroundColor = "lightgray";
            dataset.borderColor = "lightgray";
        }
        var dataset = this.config.data.datasets[legendItem.datasetIndex];
        dataset.backgroundColor = this.color;
        dataset.borderColor = this.color;
        this.config.options.scales.xAxes[0].realtime.duration = dataset.streaming.duration;
        this.config.options.scales.xAxes[0].realtime.delay = dataset.streaming.delay;
        this.charts.update();
    }
    ready() {
        this.dispatchEvent(new Event("load"));
    }

    addData(value) {
        const dataset = this.config.data.datasets[0];
        dataset.data.push(value);
        this.charts.update({
            preservation: true
        });
    }

    initData(values) {
        const dataset = this.config.data.datasets[0];
        dataset.data = values;
        this.show(null, { datasetIndex: 2 });
    }

}

customElements.define('ui-time-graph', UITimeGraph);

class RandomNumbers {
    constructor() {
        this._seed = Date.now();
    }
    rand(min, max) {
        var seed = this._seed;
        min = min === undefined ? 0 : min;
        max = max === undefined ? 1 : max;
        this._seed = (seed * 9301 + 49297) % 233280;
        return min + (this._seed / 233280) * (max - min);
    }
}
const r = new RandomNumbers();

window.statConnect = function (el, datatype) {
    var min = 0;
    var max = 100;
    switch (datatype) {
        case 'memory':
            min = 120;
            max = 300;
            break;
        case 'cpu':
            min = 20;
            max = 80;
            break;
        case 'threads':
            min = 17;
            max = 150;
            break;
    }

    var t = Date.now() - 1000 * 60;
    const minute = Array(30).fill().map(e => {
        return {
            x: (() => { t = t + (2000); return t; })(),
            y: r.rand(min, max)
        }
    });
    t = Date.now() - 1000 * 60 * 60;
    const hour = Array(29).fill().map(e => {
        return {
            x: (() => { t = t + (1000 * 60 * 2); return t; })(),
            y: r.rand(min, max)
        }
    });
    t = Date.now() - 1000 * 60 * 60 * 24;
    const day = Array(23).fill().map(e => {
        return {
            x: (() => { t = t + (1000 * 60 * 60); return t; })(),
            y: r.rand(min, max)
        }
    });
    t = Date.now() - 1000 * 60 * 60 * 24 * 8;
    const week = Array(7).fill().map(e => {
        return {
            x: (() => { t = t + (1000 * 60 * 60 * 24); return t; })(),
            y: r.rand(min, max)
        }
    });
    el.initData(week.concat(day).concat(hour).concat(minute));
    setInterval(() => el.addData({
        x: Date.now(),
        y: r.rand(min, max)
    }), 2000);
};

document.querySelectorAll("ui-time-graph").forEach(e => e.ready());
