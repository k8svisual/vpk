// Build collapsible hierarchy chart
const chartCollapsible = (input, chType) => {

    let eCount = 0;
    let nodeValue;

    const render = data => {

        const width = 1250;
        //const dx = 16;
        //const dy = width / 9;

        let dx;
        let dy;
        // type g: general chart, type  x: x-reference chart 
        if (chType === 'g') {
            dx = 16;
            dy = width / 9;
        } else if (chType === 's') {
            dx = 16;
            dy = width / 5.5;
        } else if (chType === 'x') {
            dx = 16;
            dy = width / 2.75;
        }

        const margin = { top: 10, right: 120, bottom: 10, left: 70 };

        const diagonal = d3.linkHorizontal()
            .x(d => { return d.y })
            .y(d => { return d.x });

        const tree = (root) => {
            if (chType === 'g') {
                $("#chartInfo").empty();
                $("#chartInfo").html('<span class="vpkfont-md pl-3 pb-3">Click blue dot to expand or collapse.  Red dot is final point of branch. Click red dot to view yaml.</span>'
                    + '<div class="header-right">'
                    + '<a href="javascript:printDiv(\'prtGraphic\')">'
                    + '<i class="fas fa-print mr-3 vpkcolor vpkfont-lg"></i>'
                    + '</a>'
                    + '</div>');
            } else if (chType === 's') {
                $("#securityChartInfo").empty();
                $("#securityChartInfo").html('<span class="vpkfont-md pl-3 pb-3">Click blue dot to expand or collapse.  Red dot is final point of branch. Click red dot to view yaml.</span>'
                    + '<div class="header-right">'
                    + '<a href="javascript:printDiv(\'prtGraphic\')">'
                    + '<i class="fas fa-print mr-3 vpkcolor vpkfont-lg"></i>'
                    + '</a>'
                    + '</div>');
            } else if (chType === 'x') {
                $("#xrefInfo").empty();
                $("#xrefInfo").html('<span class="vpkfont-md pl-3 pb-3">Click blue dot to expand or collapse.  Red dot is final point of branch. Click red dot to view yaml.</span>'
                    + '<div class="header-right">'
                    + '<a href="javascript:printDiv(\'prtXref\')">'
                    + '<i class="fas fa-print mr-3 vpkcolor vpkfont-lg"></i>'
                    + '</a>'
                    + '</div>');
            }
            return d3.tree().nodeSize([dx, dy])(root);
        }

        const root = d3.hierarchy(data);
        root.x0 = dy / 2;
        root.y0 = 0;
        root.descendants().forEach((d, i) => {
            d.id = i;
            d._children = d.children;
            if (d.depth && d.data.name.length !== 7) {
                d.children = null;
            }
        });

        let svg;
        if (chType === 'g') {
            svg = d3.select('#graphicCharts2')
                .attr("viewBox", [-margin.left, -margin.top, width, dx])
                .style("font", "11px sans-serif")
                .style("user-select", "none");
        } else if (chType === 's') {
            svg = d3.select('#securityCharts')
                .attr("viewBox", [-margin.left, -margin.top, width, dx])
                .style("font", "11px sans-serif")
                .style("user-select", "none");
        } else if (chType === 'x') {
            svg = d3.select('#xrefCharts2')
                .attr("viewBox", [-margin.left, -margin.top, width, dx])
                .style("font", "11px sans-serif")
                .style("user-select", "none");
        }

        const gLink = svg.append("g")
            .attr("fill", "none")
            .attr("stroke", "#755")
            .attr("stroke-opacity", 0.4)
            .attr("stroke-width", 0.50);

        const gNode = svg.append("g")
            .attr("cursor", "pointer")
            .attr("pointer-events", "all");

        // Process to expand and collapse the tree
        function update(source, value) {

            const duration = d3.event && d3.event.altKey ? 2500 : 250;
            const nodes = root.descendants().reverse();
            const links = root.links();

            // Compute the new tree layout.
            tree(root);

            let left = root;
            let right = root;
            root.eachBefore(node => {
                if (node.x < left.x) {
                    left = node
                };
                if (node.x > right.x) {
                    right = node;
                }
            });

            const height = right.x - left.x + margin.top + margin.bottom;

            const transition = svg.transition()
                .duration(duration)
                .attr("viewBox", [-margin.left, left.x - margin.top, width, height])
                .tween("resize", window.ResizeObserver ? null : () => () => svg.dispatch("toggle"));

            // Update the nodes…
            const node = gNode.selectAll("g")
                .data(nodes, d => d.id);

            // Enter any new nodes at the parent's previous position.
            const nodeEnter = node.enter().append("g")
                .attr("transform", d => `translate(${source.y0},${source.x0})`)
                .attr("fill-opacity", 0)
                .attr("stroke-opacity", 0)
                .on("click", (event, d) => {
                    d.children = d.children ? null : d._children;
                    if (typeof d.data !== 'undefined') {
                        if (typeof d.data.value !== 'undefined') {
                            nodeValue = d.data.value
                        }
                    }
                    update(d);
                });

            nodeEnter.append("circle")
                .attr("r", 4)
                .attr("fill", d => {
                    if (typeof d._children !== 'undefined') {
                        return "#29f";
                    } else {
                        return "#f33";
                    }
                    //d._children ? "#29f" : "#f33"
                })
                .attr("stroke-width", 10)
                // ------ DaW -------
                .attr("cid", d => {
                    let cid = eCount++;
                    let text = d.ancestors().map(d => d.data.name).reverse().join('::')
                    nodeValue = 'none'
                    if (typeof d.data !== 'undefined') {
                        if (typeof d.data.value !== 'undefined') {
                            nodeValue = d.data.value
                        }
                    }
                    return 'cid' + cid + '$' + text + '$' + chType + '$' + nodeValue;
                })
                .on("click", handleCollapseClick);

            nodeEnter.append("text")
                .attr("dy", "0.31rem")
                .attr("x", d => d._children ? -6 : 6)
                .attr("text-anchor", d => d._children ? "end" : "start")
                .text(d => d.data.name)
                .clone(true).lower()
                .attr("stroke-linejoin", "round")
                .attr("stroke-width", 3)
                .attr("stroke", "white");

            // Transition nodes to their new position.
            const nodeUpdate = node.merge(nodeEnter).transition(transition)
                .attr("transform", d => `translate(${d.y},${d.x})`)
                .attr("fill-opacity", 1)
                .attr("stroke-opacity", 1);

            // Transition exiting nodes to the parent's new position.
            const nodeExit = node.exit().transition(transition).remove()
                .attr("transform", d => `translate(${source.y},${source.x})`)
                .attr("fill-opacity", 0)
                .attr("stroke-opacity", 0);

            // Update the links…
            const link = gLink.selectAll("path")
                .data(links, d => d.target.id);

            // Enter any new links at the parent's previous position.
            const linkEnter = link.enter().append("path")
                .attr("d", d => {
                    const o = { x: source.x0, y: source.y0 };
                    return diagonal({ source: o, target: o });
                });

            // Transition links to their new position.
            link.merge(linkEnter).transition(transition)
                .attr("d", diagonal);

            // Transition exiting nodes to the parent's new position.
            link.exit().transition(transition).remove()
                .attr("d", d => {
                    const o = { x: source.x, y: source.y };
                    return diagonal({ source: o, target: o });
                });

            // Stash the old positions for transition.
            root.eachBefore(d => {
                d.x0 = d.x;
                d.y0 = d.y;
            });
        }

        update(root);
        return svg.node();
    }

    // input is a json data structure
    render(input);

}

const handleCollapseClick = (d, i, ct) => {
    // ct is the chType
    let cid = '';
    let chartT = '';
    let text = '';
    let fnum = '';
    if (typeof d.currentTarget !== 'undefined') {
        if (typeof d.currentTarget.attributes !== 'undefined') {
            if (typeof d.currentTarget.attributes['fill'] !== 'undefined') {
                if (typeof d.currentTarget.attributes['fill'].nodeValue !== 'undefined') {
                    if (d.currentTarget.attributes['fill'].nodeValue !== '#f33') {
                        return;
                    } else {
                        if (typeof d.currentTarget.attributes['cid'] !== 'undefined') {
                            cid = d.currentTarget.attributes['cid'].nodeValue;
                            cid = cid.split('$');
                            chartT = cid[2];
                            if (chartT === 's') {
                                if (cid[3] === 'none') {
                                    showMessage('No information available for selected item.')
                                } else {
                                    getDefFnum(cid[3]);
                                }
                            } else if (chartT === 'g') {
                                getFileByCid(cid);
                            } else if (chartT = 'x') {
                                text = cid[1];
                                text = text.split('::');
                                if (text.length > 1) {
                                    fnum = text[text.length - 1];
                                    fnum = fnum.split(':')
                                    if (typeof fnum[0] !== 'undefined') {
                                        getDefFnum(fnum[0]);
                                    }
                                }
                            }
                        } else {
                            return
                        }
                    }
                }
            }
        }
    }
}

//----------------------------------------------------------
console.log('loaded chartCollapsible.js');
