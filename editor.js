var SEGMENT_COLORS = [
	'#e41a1c',
	'#377eb8',
	'#984ea3',
	'#ff7f00',
	'#a65628'
];

function updateSegmentAttributes(segment) {
	segment.distance = 0;
	segment.enabled = true;
	segment.maxSpeed = 0;
	var i = 1;
	var len = segment.length;
	for (; i < len; i += 1) {
		var pt = segment[i];
		segment.distance += pt.distance;
		segment.maxSpeed = Math.max(segment.maxSpeed, pt.speed);
	}
	segment.duration = segment[len - 1].time - segment[0].time;
	segment.avgSpeed = segment.distance / segment.duration;

	// Those properties will be only present when splitting segments
	delete segment[0].distance;
	delete segment[0].speed;
}

function extractSegments(pts, maxDuration, maxDistance) {
	var segments = [];
	var segment = [pts[0]];
	var i = 0;
	var j = 1;
	var len = pts.length;

	for (; j < len; i += 1, j += 1) {
		var pt1 = pts[i];
		var pt2 = pts[j];
		var duration = pt2.time - pt1.time;
		var distance = calcDistance(pt1, pt2);
		if (duration < maxDuration && distance < maxDistance) {
			pt2.distance = distance;
			pt2.speed = distance / duration;
			segment.push(pt2);
		} else {
			if (segment.length > 3) {
				segments.push(segment);
			}
			segment = [pt2];
		}
	}

	if (segment.length > 3) {
		segments.push(segment);
	}

	segments.forEach(updateSegmentAttributes);

	return segments;
}

function fitMap(map, segments) {
	var points = segments.reduce(function (points, segment) {
		if (segment.enabled) {
			return points.concat(segment);
		}
		return points;
	}, []);

	map.fitBounds([
		[
			Math.min.apply(Math, points.map(function (pt) {
				return pt.lat;
			})),
			Math.min.apply(Math, points.map(function (pt) {
				return pt.lon;
			}))
		],
		[
			Math.max.apply(Math, points.map(function (pt) {
				return pt.lat;
			})),
			Math.max.apply(Math, points.map(function (pt) {
				return pt.lon;
			}))
		]
	]);
}

function convertToLatLon(pt) {
	return [pt.lat, pt.lon];
}

function drawMap(elementId, segments) {
	var $mapEl = $(document.getElementById(elementId));
	//$mapEl.height($mapEl.height());
	var map = L.map(elementId);

	L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
		attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
		maxZoom: 18
	}).addTo(map);

	var currentColor = -1;

	segments.forEach(function (segment, segmentIndex) {
		currentColor += 1;
		currentColor %= SEGMENT_COLORS.length;
		if (segment.enabled) {
			var line = L.polyline(segment.map(convertToLatLon), {
				color: SEGMENT_COLORS[currentColor],
				weight: 6
			}).addTo(map);
			line.on('click', function (ev) {
				deselectSegment();
				selectSegment(segmentIndex);
				L.DomEvent.stopPropagation(ev);
			});
		}
	});

	fitMap(map, segments);

	map.on('click', deselectSegment);

	return map;
}

function getDisplayedSpeed(speed, format) {
	var value = speed * 3.6;
	return format ? value.toFixed(1) + ' km/h' : value;
}

function getDisplayedDuration(duration) {
	return [Math.ceil(duration / 60), duration % 60].join(':');
}

function genChartData(segments) {
	var len = segments.length;
	var data = new google.visualization.DataTable();
	data.addColumn('date', 'Time');
	var rowId = 0;
	segments.forEach(function (segment, segmentIndex) {
		var colId = segmentIndex + 1;
		data.addColumn('number', 'Segment #' + colId);
		if (segment.enabled) {
			for (var i = 1, segmentLen = segment.length; i < segmentLen; i += 1) {
				data.addRows(1);
				data.setCell(rowId, 0, new Date(segment[i].time * 1000));
				data.setCell(rowId, colId, getDisplayedSpeed(segment[i].speed));
				rowId += 1;
			}
		}
	});
	return data;
}

function getPosition(segments, row) {
	row += 1;
	var segmentId = 0;
	var pointId;
	while (true) {
		var segment = segments[segmentId];
		if (segment.enabled) {
			if (row < segment.length) {
				pointId = row;
				break;
			}
			row -= segment.length - 1;
		}
		segmentId += 1;
	}
	var point = JSON.parse(JSON.stringify(segments[segmentId][pointId]));
	point.segmentId = segmentId;
	point.pointId = pointId;
	return point;
}

function drawChart(elementId, segments, map) {
	google.charts.load('current', {packages: ['corechart', 'line']});
	google.charts.setOnLoadCallback(drawBasic);

	function drawBasic() {

		var data = genChartData(segments);

		var options = {
			colors: SEGMENT_COLORS,
			crosshair: {
				orientation: 'vertical',
				trigger: 'focus'
			},
			curveType: 'function',
			focusTarget: 'category',
			legend: {
				position: 'none'
			},
			vAxis: {
				title: 'Speed (km/h)',
				viewWindow: {
					min: 0
				}
			}
		};

		var chart = new google.visualization.LineChart(document.getElementById(elementId));


		function selectSplitPoint() {
			deselectSegment();
			var point = chart.getSelection()[0];
			if (!point) {
				return;
			}
			var position = getPosition(segments, point.row);
			selectSegment(position.segmentId);
			var $a = $('<a href="#split">Split segment here</a>');
			$a.attr('data-segment-id', position.segmentId);
			$a.attr('data-point-id', position.pointId);
			L.popup().setLatLng([position.lat, position.lon])
				.setContent($('<p></p>').html($a)[0].outerHTML)
				.openOn(map);
		}

		chart.draw(data, options);
		google.visualization.events.addListener(chart, 'onmouseover', function (point) {
			if (!point) {
				return;
			}
			var position = getPosition(segments, point.row);
			L.popup().setLatLng([position.lat, position.lon])
				.setContent('<p>Here</p>')
				.openOn(map);
		});

		google.visualization.events.addListener(chart, 'select', selectSplitPoint);
		$(document.getElementById(elementId)).on('mouseleave', selectSplitPoint);

		$(window).on('resize', function () {
			chart.draw(data, options);
		});
	}
}

function deselectSegment() {
	$('#split-table tr').removeClass('is-selected');
}

function selectSegment(segmentIndex) {
	$('#split-table tr').eq(segmentIndex + 1).addClass('is-selected');
}

function drawTable(elementId, segments) {
	var $tbody = $('tbody', document.getElementById(elementId));
	$tbody.html('');
	var currentColor = 0;
	segments.forEach(function (segment, index) {
		var $marker = $('<td><span class="marker"></span></td>');
		$marker.find('.marker').css('border-color', SEGMENT_COLORS[currentColor]);
		$tbody.append($('<tr data-toggle-segment></tr>')
			.attr('data-segment-id', index)
			.toggleClass('is-enabled', segment.enabled)
			.append($marker)
			.append('<td>' + segment.distance.toFixed(0) + ' m</td>')
			.append('<td>' + getDisplayedDuration(segment.duration) + '</td>')
			.append('<td>' + getDisplayedSpeed(segment.maxSpeed, true) + '</td>')
			.append('<td>' + getDisplayedSpeed(segment.avgSpeed, true) + '</td>')
		);
		currentColor += 1;
		currentColor %= SEGMENT_COLORS.length;
	});
}

function generateDataLink(data) {
	return 'data:application/gpx+xml;charset=utf-8,' + encodeURIComponent(data);
}

function initUI(gpxInput) {
	$('#input').hide();
	$('#editor').show();
	var points = parseGpx(gpxInput);
	var segments = extractSegments(points, 120, 500);
	var map;

	function refreshUi() {
		if (map) {
			map.remove();
		}

		drawTable('split-table', segments);
		map = drawMap('lf-map', segments);
		drawChart('g-chart', segments, map);
		$('#download-gpx').attr('href', generateDataLink(updateGpx(gpxInput, segments)));
	}

	$('body').on('click', '[data-toggle-segment]', function () {
		var $this = $(this);
		if ($('tr.is-enabled').length < 2 && $this.hasClass('is-enabled')) {
			return;
		}
		var segmentId = $this.attr('data-segment-id');
		$this.toggleClass('is-enabled');
		segments[segmentId].enabled = $this.hasClass('is-enabled');
		refreshUi();
	});

	$('body').on('click', '[href="#split"]', function (ev) {
		ev.preventDefault();
		var $this = $(this);
		var segmentId = $this.attr('data-segment-id');
		var pointId = $this.attr('data-point-id');
		var segmentToSplit = segments[segmentId];
		var splitSegmentLeft = segmentToSplit.slice(0, pointId);
		var splitSegmentRight = segmentToSplit.slice(pointId);

		updateSegmentAttributes(splitSegmentLeft);
		updateSegmentAttributes(splitSegmentRight);

		segments.splice(segmentId, 1, splitSegmentLeft, splitSegmentRight);
		refreshUi();
	});

	refreshUi();
}

$('#input-gpx').on('change', function (ev) {
	var file = ev.target.files[0];
	var reader = new FileReader();
	reader.readAsText(file);
	reader.onload = function () {
		initUI(reader.result);
	};
});
