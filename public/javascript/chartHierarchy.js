// Build collapsible hierarchy chart
const chartHierarchy = (input, chType) => {
    let eCount = 0;
    let width = 1250;
    let height = 500;
    let svg;

    // type g: general chart, type  x: x-reference chart 
    if (chType === 'x') {

        $("#xrefInfo").empty();
        $("#xrefInfo").html('<span class="vpkfont-md pl-3 pb-3">Expanded hierarchy (click red dot to view resource)</span>'
            + '<div class="header-right">'
            + '<a href="javascript:printDiv(\'prtXref\')">'
            + '<i class="fas fa-print mr-3 vpkcolor vpkfont-lg"></i>'
            + '</a>'
            + '</div>');

        svg = d3.select('#xrefCharts2')
            .style("font", "11px sans-serif")
            .style("overflow", "visible")
            .attr("text-anchor", "middle");
    } else {
        $("#chartInfo").empty();
        $("#chartInfo").html('<span class="vpkfont-md pl-3 pb-3">Expanded hierarchy (click red dot to view resource)</span>'
            + '<div class="header-right">'
            + '<a href="javascript:printDiv(\'prtGraphic\')">'
            + '<i class="fas fa-print mr-3 vpkcolor vpkfont-lg"></i>'
            + '</a>'
            + '</div>');

        svg = d3.select('#graphicCharts2')
            .style("font", "11px sans-serif")
            .style("overflow", "visible")
            .attr("text-anchor", "middle");
    }

    const tree = data => {
        const root = d3.hierarchy(data);
        root.dx = 16;
        root.dy = width / (root.height + 1);
        return d3.tree().nodeSize([root.dx, root.dy])(root);
    }

    const render = data => {
        const root = tree(data);

        let x0 = Infinity;
        let x1 = -x0;
        root.each(d => {
            if (d.x > x1) x1 = d.x;
            if (d.x < x0) x0 = d.x;
        });

        // calculate height of svg region and set the attribute
        height = +x1 - x0 + root.dx * 2;
        height = height + 100;
        svg
            .attr('height', height)
            .attr('width', width)

        const g = svg.append("g")
            .attr("font-family", "sans-serif")
            .attr("font-size", 10)
            .attr("transform", `translate(${root.dy / 3},${root.dx - x0})`);

        const link = g.append("g")
            .attr("fill", "none")
            .attr("stroke", "#755")
            .attr("stroke-opacity", 0.4)
            .attr("stroke-width", 0.5)
            .selectAll("path")
            .data(root.links())
            .join("path")
            .attr("d", d3.linkHorizontal()
                .x(d => d.y)
                .y(d => d.x));

        const node = g.append("g")
            .attr("stroke-linejoin", "round")
            .attr("stroke-width", 3)
            .selectAll("g")
            .data(root.descendants())
            .join("g")
            .attr("transform", d => `translate(${d.y},${d.x})`);

        node.append("text")
            .attr("dy", "0.31em")
            .attr("x", d => d.children ? -6 : 6)
            .attr("text-anchor", d => d.children ? "end" : "start")
            .text(d => d.data.name)
            .clone(true).lower()
            .attr("stroke", "white");

        node.append("circle")
            .attr("fill", d => d.children ? "#999" : "#f33")
            .attr("r", 4)
            // ------ DaW -------
            .attr("cid", d => {
                let cid = eCount++;
                let text = d.ancestors().map(d => d.data.name).reverse().join('::')
                return 'cid' + cid + '$' + text + '$' + chType;
            })
            .on("click", handleHierarchyClick);
        return svg.node();
    };

    // input is a json data structure
    render(input);
}


const handleHierarchyClick = (d, i, ct) => {
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
                            if (chartT === 'g') {
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
console.log('loaded chartHierarchy.js');
