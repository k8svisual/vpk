// vpkGraphvizManager.js

(function () {
    var graphvizInstances = {};
    var contextMonitors = {};

    function renderGraph(containerId, dotData, nodeCount, options) {
        nodeCount = nodeCount || 100;
        options = options || {};
        var zoom = options.zoom || false;
        var trackContext = options.trackContext || false;
        var onRenderEnd = options.onRenderEnd || null;

        var wrapper = document.getElementById(containerId);
        if (!wrapper) {
            console.error("renderGraph: container '" + containerId + "' not found");
            return;
        }

        var height = Math.min(8000, Math.max(2000, nodeCount * 20)) + 'pt';

        try {
            if (graphvizInstances[containerId]) {
                graphvizInstances[containerId].transition().remove();
            }
        } catch (e) {
            // ignore on first use
        }

        // Plain string, not template literal
        wrapper.innerHTML =
            '<div id="' + containerId + '-viz" style="width: 100%; height: 100%; text-align: center;"></div>';

        var graphvizEl = d3.select('#' + containerId + '-viz');

        var viz = graphvizEl
            .graphviz({ useWorker: false })
            .zoom(false)
            .height(height)
            .renderDot(dotData)
            .on('end', function () {
                setTimeout(function () {
                    if (zoom) {
                        var svg = graphvizEl.select('svg');
                        var g = svg.select('g');

                        if (!svg.empty() && !g.empty()) {
                            svg.call(
                                d3.zoom()
                                    .scaleExtent([0.1, 10])
                                    .on('zoom', function (event) {
                                        g.attr('transform', event.transform);
                                    })
                            );
                        } else {
                            console.warn('Zoom setup failed — SVG or G not found inside #' + containerId + '-viz');
                        }
                    }

                    if (typeof onRenderEnd === 'function') {
                        onRenderEnd();
                    }

                    if (trackContext && !contextMonitors[containerId]) {
                        var el = document.getElementById(containerId + '-viz');
                        if (el) {
                            el.addEventListener('webglcontextlost', function (e) {
                                console.warn('🚨 WebGL context lost in ' + containerId + '-viz', e);
                            });
                            contextMonitors[containerId] = true;
                        }
                    }
                }, 100);
            });

        graphvizInstances[containerId] = viz;
    }

    function clearAllGraphs() {
        for (var id in graphvizInstances) {
            if (graphvizInstances.hasOwnProperty(id)) {
                try {
                    graphvizInstances[id].transition().remove();
                } catch (e) {
                    console.warn('clearAllGraphs: could not remove graphviz instance for ' + id, e);
                }
            }
        }
    }

    // Expose globally
    window.graphvizManager = {
        renderGraph: renderGraph,
        clearAllGraphs: clearAllGraphs
    };
})();

console.log("loaded vpkGraphvizManager.js");
