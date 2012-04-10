var KM_PER_MILE = 1.609344;
var MIN_KM_PER_HOUR = 8;
var MAX_KM_PER_HOUR = 21;

function to_fixed(value, precision) {
    var power = Math.pow(10, precision || 0);
    return (Math.round(value * power) / power).toFixed(precision);
}

function to_mins_secs(mins) {
    var hours = Math.floor(mins / 60);
    mins %= 60;
    var whole_mins = Math.floor(mins);
    var secs = (mins - whole_mins) * 60;

    if (hours > 0)
        return sprintf("%d:%02d'%02d\"", hours, whole_mins, secs);

    return sprintf("%d'%02d\"", whole_mins, secs);
}

function pace_tick_generator(slowest, fastest, step1, step2, threshold) {
    return function(axis) {
        var res = [], pace = slowest;
        do {
            res.push([60.0 / pace, to_mins_secs(pace)]);
            if (pace < threshold)
                pace += step1;
            else
                pace += step2;
        } while (pace <= fastest);
        return res;
    };
}

function predict_time(old_time, old_dist, new_dist) {
    // http://run-down.com/statistics/calcs_explained.php

    // Pete Riegel's Model
    return old_time * Math.pow(new_dist / old_dist, 1.06);

    // FIXME - Dave Cameron's Model
    a = 13.49681 - (0.000030363 * old_dist) + (835.7114 / Math.pow(old_dist, 0.7905));
    b = 13.49681 - (0.000030363 * new_dist) + (835.7114 / Math.pow(new_dist, 0.7905));
    return (old_time / old_dist) * (a / b) * new_dist;
}

function predict_speed(old_time, old_dist, new_dist) {
    var predicted_time = predict_time(old_time / 60, old_dist, new_dist);
    return new_dist / predicted_time;
}

function get_predictions(old_time, old_dist) {
    var predictions = [];
    for (var new_dist = 0.1; new_dist <= 50; new_dist += 0.1) {
        predictions.push([new_dist, predict_speed(old_time, old_dist, new_dist)]);
    }
    return predictions;
}

var xaxes = [
    {
        position: "bottom",
        axisLabel: "distance",
        min: 0,
        max: 50,
        ticks: [
            [0.4, ""],
            [0.8, ""],
            1, 3, 5, 10, 15, 20,
            [21.1, "     21.1"],
            25, 30, 35, 40,
            [42.2, "42.2"]
        ]
    }
];

var yaxes = [
    {
        position: "left",
        axisLabel: "km/hr",
        min: MIN_KM_PER_HOUR,
        max: MAX_KM_PER_HOUR,
        tickSize: 0.5,
        tickDecimals: 1
    },
    {
        show: true,
        position: "left",
        axisLabel: "miles/hr",
        min: MIN_KM_PER_HOUR / KM_PER_MILE,
        max: MAX_KM_PER_HOUR / KM_PER_MILE,
        tickSize: 0.5,
        alignTicksWithAxis: 1
    },
    {
        show: true,
        position: "right",
        axisLabel: "mins/mile",
        min: MIN_KM_PER_HOUR / KM_PER_MILE,
        max: MAX_KM_PER_HOUR / KM_PER_MILE,
        ticks: pace_tick_generator(4, 14, 0.25, 0.5, 10),
        alignTicksWithAxis: 1
    },
    {
        show: true,
        position: "right",
        axisLabel: "mins/km",
        min: MIN_KM_PER_HOUR,
        max: MAX_KM_PER_HOUR,
        ticks: pace_tick_generator(2, 9, 0.25, 0.5, 7),
        alignTicksWithAxis: 1
    }
];

function keyhandler(plot, eventHolder) {
    eventHolder.keydown(function (event) {
        console.log(event);
        if (event.shiftKey) {
            shiftPressed = true;
            console.log("shift down");
        }
    });
}

var hooks = {
    bindEvents: [keyhandler]
};

var chart_options = {
    crosshair: {
        mode: "xy"
    },
    grid: {
        clickable: true,
        hoverable: true,
        autoHighlight: true
    },
    legend: {
        show: true,
        position: "ne"
    },
    xaxes: xaxes,
    yaxes: yaxes,
    hooks: hooks
};

function plot_chart(predictions) {
    var data = [ { data: predictions, label: "Riegel" } ];
    return $.plot(
        $('#chartdiv'),
        data,
        chart_options
    );
}

var updateLegendTimeout = null;
var latestPosition = null;

function updateLegend() {
    updateLegendTimeout = null;
  
    var pos = latestPosition;
  
    var axes = plot.getAxes();
    if (pos.x < axes.xaxis.min || pos.x > axes.xaxis.max ||
        pos.y < axes.yaxis.min || pos.y > axes.yaxis.max)
        return;

    var i, j, dataset = plot.getData();
    for (i = 0; i < dataset.length; ++i) {
        var series = dataset[i];

        // find the nearest points, x-wise
        for (j = 0; j < series.data.length; ++j)
            if (series.data[j][0] > pos.x)
                break;

        // now interpolate
        var y, p1 = series.data[j - 1], p2 = series.data[j];
        if (p1 == null)
            y = p2[1];
        else if (p2 == null)
            y = p1[1];
        else
            y = p1[1] + (p2[1] - p1[1]) * (pos.x - p1[0]) / (p2[0] - p1[0]);

        // snap to data series
        if (Math.abs(y - pos.y) > 0.2)
            y = pos.y;
    }

    var x = pos.x;
    //var y = pos.y;
    var miles_per_hr = y / KM_PER_MILE;
    var time = x * 60 / y;

    $('#time .dataValue'        ).html(to_mins_secs(time));
    $('#km.dataValue'           ).html(x.toFixed(2));
    $('#miles.dataValue'        ).html((x / KM_PER_MILE).toFixed(2));
    $('#km_per_hr.dataValue'    ).html(y.toFixed(2));
    $('#miles_per_hr.dataValue' ).html(miles_per_hr.toFixed(2));
    $('#mins_per_km.dataValue'  ).html(to_mins_secs(60.0 / y));
    $('#mins_per_mile.dataValue').html(to_mins_secs(60.0 / miles_per_hr));
}

var predictions, plot, last_y, shiftPressed;

$(document).ready(function() {
    predictions = get_predictions(40, 10);
    plot = plot_chart(predictions);

    $('.dataValue').each(function () {
        // fix the widths so they don't jump around
        $(this).css('width', $(this).width());
    });

    $('#chartdiv').bind('plothover', function (event, pos, item) {
        if (shiftPressed) {
            console.log("shift");
            pos.y = last_y;
        }
        else
            last_y = pos.y;

        latestPosition = pos;
        if (! updateLegendTimeout)
            updateLegendTimeout = setTimeout(updateLegend, 50);
    });

    $('#chartdiv').keyup(function (event) {
        if (event.shiftKey) {
            shiftPressed = false;
            console.log("shift up");
        }
    });

    $('#chartdiv').bind('plotclick', function (event, pos, item) {
        var dist  = pos.x;
        var speed = pos.y;
        var time  = dist * 60 / speed;
        predictions = get_predictions(time, dist);
        plot = plot_chart(predictions);
    });
});
