// Build circle pack chart
const chartCirclePack = (input, chType) => {
    const render = (data) => {
        let leafCnt = 0;
        let clipCnt = 0;
        let eCount = 0;
        const width = 975;
        const height = width;

        const pack = data => {
            const payload = d3.pack()
                .size([width, height])
                .padding(5)
                (d3.hierarchy(data)
                    .sum(d => d.value)
                    .sort((a, b) => b.value - a.value));
            // type g: general chart, type  x: x-reference chart 
            if (chType === 'g') {
                $("#chartInfo").empty();
                $("#chartInfo").html('<span class="vpkfont-md pl-3">View additional informaiton by placing cursor over item. Blue dots can be clicked to view yaml.<span>'
                    + '<div class="header-right">'
                    + '<a href="javascript:printDiv(\'prtGraphic\')">'
                    + '<i class="fas fa-print mr-3 vpkcolor vpkfont-lg"></i>'
                    + '</a>'
                    + '</div>');

            } else if (chType === 'x') {
                $("#xrefInfo").empty();
                $("#xrefInfo").html('<span class="vpkfont-md pl-3">View additional informaiton by placing cursor over item. Blue dots can be clicked to view yaml.<span>'
                    + '<div class="header-right">'
                    + '<a href="javascript:printDiv(\'prtXref\')">'
                    + '<i class="fas fa-print mr-3 vpkcolor vpkfont-lg"></i>'
                    + '</a>'
                    + '</div>');
            }
            return payload;
        }

        const margin = { 'left': 100, 'top': 50 }
        const root = pack(data);
        let svg;
        if (chType === 'g') {
            svg = d3.select('#graphicCharts2')
                .attr("viewBox", [0, 0, width, height])
                .style("font", "10px sans-serif")
                .style("overflow", "visible")
                .attr("text-anchor", "middle")
                .call(zoom);
        } else if (chType === 'x') {
            svg = d3.select('#xrefCharts2')
                .attr("viewBox", [0, 0, width, height])
                .style("font", "10px sans-serif")
                .style("overflow", "visible")
                .attr("text-anchor", "middle")
                .call(zoom);
        }

        const node = svg.append("g")
            .attr("pointer-events", "all")
            .selectAll("g")
            .data(root.descendants())
            .join("g")
            .attr("transform", d => `translate(${d.x},${d.y})`);

        node.append("circle")
            .attr("r", d => d.r)
            .attr("stroke", d => d.children ? "#222" : "none")
            .attr("stroke-width", 0.3)
            .attr("fill", d => {
                let rtn;
                rtn = d.children ? "#f7f7f7" : "#007bff";
                return rtn;
            })
            .attr("cid", d => {
                let cid = eCount++;
                let text = d.ancestors().map(d => d.data.name).reverse().join('::')
                return 'cid' + cid + '$' + text + '$' + chType;
            })
            .on("mouseover", handleCPMouseOver)
            .on("mouseout", handleCPMouseOut)
            .on("click", handleCPClick);

        const leaf = node.filter(d => !d.children);

        leaf.select("circle")
            .attr("id", d => (d.leafUid = "leaf" + leafCnt++));

        leaf.select("circle")
            .attr("id", d => (d.leafUid = "leaf" + leafCnt++))
            .on("mouseover", handleCPMouseOver)
            .on("mouseout", handleCPMouseOut)
            .on("click", handleCPClick);

        leaf.append("clipPath")
            .attr("id", d => d.clipUid = "clip" + clipCnt++);

        leaf.append("text")
            .attr("clip-path", d => d.clipUid)
            .selectAll("tspan")
            .data(d => d.data.name.split(/(?=[A-Z][^A-Z])/g))
            .join("tspan")
            .attr("x", 0)
            .attr("y", (d, i, nodes) => `${i - nodes.length / 2 + 0.8}em`);

        return svg.node();
    }
    render(input);
}


var lastMove;
var elapsed;

function handleCPMouseOver(d, i) {
    // elapsed = Date.now() - lastMove;
    if (elapsed < 300) {
        return;
    }
    let cid;
    if (typeof this.attributes['cid'] !== 'undefined') {
        cid = this.attributes['cid'].nodeValue;
        //console.log('cid: ' + cid + ' @ x;' + d.x + ' y:' + d.y)
        cid = cid.split('$');
        let text = cid[1];
        let chartT = cid[2];
        text = text.split('::');
        let tip = '<div class="vpkfont-md">';
        let i = 0;
        let show = false;
        // handle the graphics chart
        if (text.length > 2 && chartT === 'g') {
            show = true;
            for (i = 1; i < text.length; i++) {
                let v1 = '';
                if (text[i] === 'Namespaces') {
                    v1 = 'Namespace</b>';
                } else {
                    v1 = text[i];
                }
                tip = tip + '<b>' + v1 + '</b>';
                i++;
                if (typeof text[i] !== 'undefined') {
                    tip = tip + ': ' + text[i] + '<br>';
                } else {
                    if (tip.indexOf('VolumeMounts') === -1) {
                        tip = tip + '(s)';
                    } else {
                        tip = tip;
                    }
                }
            }
        }

        // handle the xref chart
        if (chartT === 'x') {
            if (text.length === 2) {
                if (typeof text[1] !== 'undefined') {
                    show = true;
                    tip = '<b>Xref value: </b>' + text[1] + '<br>Click blue dot to view info about occurrence'
                }
            }
        }


        if (show === true) {

            let pageY = d.clientY;
            //let offTop  = $("#schematicDetail").offset().top;
            let offTop;
            if (chartT === 'g') {
                offTop = $("#prtGraphic").offset().top;
            } else {
                offTop = $("#prtXref").offset().top;
            }
            //let offTop  = window.pageYOffset;
            console.log(offTop)
            let tipX = d.clientX - 100;
            // adjust for fixed portion of page
            if (offTop < 0) {
                offTop = offTop * -1;
                offTop = offTop + 210;
            } else {
                offTop = 214 - offTop;
            }

            let tipY = offTop + pageY;
            tipY = tipY - 90;

            // populate the tool tip and placement
            tip = tip + '</div>';
            tooltip.innerHTML = tip;
            tooltip.style.display = "block";
            tooltip.style.left = tipX + 'px';
            tooltip.style.top = tipY + 'px';
        }
    }
    lastMove = Date.now();
}

function handleCPMouseOut(d, i) {
    hideVpkTooltip();
}

function handleCPClick(d, i, ct) {
    // ct is the chart type
    let cid = '';
    let chartT = '';
    let secret = false;
    if (typeof this.attributes['cid'] !== 'undefined') {
        cid = this.attributes['cid'].nodeValue;
        if (cid.indexOf('::Secret::') > -1) {
            secret = true;
        }
        cid = cid.split('$');
        chartT = cid[2];
    }

    if (chartT === 'g') {
        getFileByCid(cid, secret)
    } else if (chartT === 'x') {
        let tmp = cid[1].split('::');
        let fp = tmp.indexOf(':');
        if (fp > -1) {
            tmp = tmp.substring(0, fp);
        }
        if (secret === true) {
            getDefSec(tmp[2]);
        } else {
            getDefFnum(tmp[2])
        }
    }
}


//----------------------------------------------------------
console.log('loaded chartCirclePack.js');
