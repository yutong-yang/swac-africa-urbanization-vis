function View2(Observer) {
    var view2 = {};
    var $bmDiv = $("#view2");
    var margin = { top: 20, right: 30, bottom: 40, left: 300 };
    var width = $bmDiv.width(), height = $bmDiv.height();
    var graphWidth = width - margin.left - margin.right;
    var graphHeight = height - margin.top - margin.bottom;

    var svg = d3.select("#view2")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("class", "view2");

    var svg_g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    var tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "white")
        .style("border", "1px solid black")
        .style("padding", "5px")
        .style("border-radius", "5px")
        .style("pointer-events", "none")
        .style("opacity", 0);

    let countryData = [];
    let years = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020, 2030, 2040, 2050];

    function loadCSVData() {
        d3.csv("./data/country_cleaned.csv", d3.autoType).then(function(data) {
            data = data.filter(d => d.AU_Regions !== "Region" && d.AU_Regions !== "Regional entities");

            countryData = data.map(d => {
                let newData = { Country: d.Country, AU_Regions: d.AU_Regions };
                for (let i = 1; i < years.length; i++) {
                    let prevYear = years[i - 1];
                    let currYear = years[i];
                    let prevValue = parseFloat(d[`Urbanlevel${prevYear}`].replace('%', '')) || 0;
                    let currValue = parseFloat(d[`Urbanlevel${currYear}`].replace('%', '')) || 0;
                    newData[`Growth${currYear}`] = currValue - prevValue;
                    newData[`Urbanlevel${currYear}`] = currValue;
                }
                newData[`Urbanlevel1950`] = parseFloat(d[`Urbanlevel1950`].replace('%', '')) || 0;
                return newData;
            });

            let regions = [...new Set(countryData.map(d => d.AU_Regions))];
            let sortedCountryData = regions.flatMap(region => {
                return countryData.filter(d => d.AU_Regions === region).sort((a, b) => a.Country.localeCompare(b.Country));
            });
            countryData = sortedCountryData;

            years = years.slice(1);
            drawHeatmap();
        });
    }

    var cellGroups;

    function drawHeatmap() {
        var xScale = d3.scaleBand()
            .domain(years)
            .range([0, graphWidth])
            .padding(0.1);

        var yScale = d3.scaleBand()
            .domain(countryData.map(d => d.Country))
            .range([0, graphHeight])
            .padding(0.1);

        var colorScale = d3.scaleLinear()
            .domain([0, 100])
            .range(['rgba(0, 0, 0, 0)', 'rgb(230, 217, 188)']);

        var colorScale2 = d3.scaleLinear()
            .domain([-20, 0, 100])
            .range(['rgb(255, 255, 255)', 'rgba(103, 165, 212, 0.8)']);

        var radiusScale = d3.scaleSqrt()
            .domain([0, 100])
            .range([0, 6]);

        svg_g.append("g")
            .attr("transform", `translate(0,${graphHeight})`)
            .call(d3.axisBottom(xScale))
            .selectAll("text")
            .style("font-family", "Arial")
            .style("font-size", "12px");

        svg_g.append("g")
            .call(d3.axisLeft(yScale))
            .selectAll("text")
            .style("font-family", "Arial")
            .style("font-size", "12px");

        cellGroups = svg_g.selectAll(".cellGroup")
            .data(countryData)
            .join("g")
            .attr("class", "cellGroup");

        cellGroups.selectAll(".cell")
            .data(d => years.map(year => ({
                country: d.Country,
                year: year,
                urbanlevel: d[`Urbanlevel${year}`],
                growth: d[`Growth${year}`]
            })))
            .join("rect")
            .attr("class", "cell")
            .attr("x", d => xScale(d.year))
            .attr("y", d => yScale(d.country))
            .attr("width", xScale.bandwidth())
            .attr("height", yScale.bandwidth())
            .attr("fill", d => {
                if (d.urbanlevel === null || isNaN(d.urbanlevel)) {
                    return "#ccc";
                }
                return colorScale(d.urbanlevel);
            })
            .style("stroke", 'none')
            .on("mouseover", function(event, d) {
                tooltip.transition()
                    .duration(200)
                    .style("opacity", 0.9);
                tooltip.html(`
                    <strong>${d.country}</strong><br/>
                    Year: ${d.year}<br/>
                    Urbanlevel: ${(d.urbanlevel || 0).toFixed(2)}%<br/>
                    Growth: ${(d.growth || 0).toFixed(2)}%
                `)
                    .style("left", `${event.pageX + 10}px`)
                    .style("top", `${event.pageY - 28}px`);
            })
            .on("mousemove", function(event) {
                tooltip.style("left", `${event.pageX + 10}px`)
                    .style("top", `${event.pageY - 28}px`);
            })
            .on("mouseout", function() {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            })
            .on("click", function(event, d) {
                var countryName = d.country;
                var currentYear = d.year;
                var selectedData = {
                    country: countryName,
                    year: currentYear
                };
                updateHeatmap(selectedData);
                obs.fireEvent('countrySelected', selectedData, 'View2');
            })
            ;

        cellGroups.selectAll(".cell-text")
        .data(d => years.map(year => ({
            country: d.Country,
            year: year,
            value: d[`Growth${year}`]
        })))
        .join("text")
        .attr("class", "cell-text")
        .attr("x", d => xScale(d.year) + xScale.bandwidth() / 2)
        .attr("y", d => yScale(d.country) + yScale.bandwidth() / 2)
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "central")
        .style("font-family", "Arial")
        .style("font-size", "10px")
        // .style("font-weight", "bold")
        // .style("fill", "rgba(0,0,0,0.8)")
        .text(d => {
            if (d.value === null || isNaN(d.value)) return "";
            if (d.value < 0 || d.value >= 50) {
                return `${d.value >= 0 ? "+" : ""}${d.value.toFixed(0)}%`;
            } else {
                return "";
            }
        });

        cellGroups.selectAll(".cell-circle")
            .data(d => years.map(year => ({
                country: d.Country,
                year: year,
                growth: d[`Growth${year}`]
            })))
            .join("circle")
            .attr("class", "cell-circle")
            .attr("cx", d => xScale(d.year) + xScale.bandwidth() / 2)
            .attr("cy", d => yScale(d.country) + yScale.bandwidth() / 2)
            .attr("r", d => (d.growth && !isNaN(d.growth)) ? radiusScale(Math.abs(d.growth)) : 0)
            .attr("fill", d => colorScale2(d.growth))
            .style("opacity", 0.7);
    

        var legend = svg_g.append("g")
            .attr("transform", `translate(${graphWidth + 20}, 0)`);

        var legendScale = d3.scaleLinear()
            .domain([0, 100])
            .range([0, 200]);

        legend.append("rect")
            .attr("x", 0)
            .attr("y", 40)
            .attr("width", 200)
            .attr("height", 20)
            .attr("fill", "url(#gradient)");

        var gradient = svg_g.append("defs")
            .append("linearGradient")
            .attr("id", "gradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");

        gradient.append("stop")
            .attr("offset", "0%")
            .attr("style", `stop-color:${colorScale(0)};stop-opacity:1`);

        gradient.append("stop")
            .attr("offset", "100%")
            .attr("style", `stop-color:${colorScale(100)};stop-opacity:1`);

        let regions = [...new Set(countryData.map(d => d.AU_Regions))];
        let regionIndices = regions.map(region => countryData.findIndex(d => d.AU_Regions === region));

        svg_g.append("line")
            .attr("x1", -width)
            .attr("y1", yScale(countryData[0].Country) - 1)
            .attr("x2", graphWidth)
            .attr("y2", yScale(countryData[0].Country) - 1)
            .attr("stroke", "rgba(255, 255, 255, 0.8)")
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", "2,2");

        regionIndices.forEach((index, i) => {
            if (i === 0) return;

            svg_g.append("line")
                .attr("x1", -width)
                .attr("y1", yScale(countryData[index - 1].Country) + yScale.bandwidth() + 1)
                .attr("x2", graphWidth)
                .attr("y2", yScale(countryData[index - 1].Country) + yScale.bandwidth() + 1)
                .attr("stroke", "rgba(255, 255, 255, 0.8)")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "2,2");

            svg_g.append("text")
                .attr("x", -margin.left)
                .attr("y", yScale(countryData[index - 1].Country) + yScale.bandwidth() + 15)
                .text(regions[i])
                .style("font-family", "Arial")
                .style("font-size", "12px");
        });

        svg_g.append("text")
            .attr("x", -margin.left)
            .attr("y", yScale(countryData[0].Country) + yScale.bandwidth() / 2 + 5)
            .text(regions[0])
            .style("font-family", "Arial")
            .style("font-size", "12px");
    }

    function updateHeatmap(selectedData) {
        selectedCountry = selectedData.country;
        selectedYear = selectedData.year;

        cellGroups.selectAll(".cell").each(function(d) {
            if (d.country == selectedCountry && d.year == selectedYear) {
                d3.select(this)
                    .style("stroke", "rgba(255, 255, 255, 0.9)")
                    .style("stroke-width", 3);
            } else {
                d3.select(this)
                    .style("stroke", "none");
            }
        });
    }

    loadCSVData();

    // Response
    view2.onMessage = function(message, data, from){
        if (message === 'countrySelected' && from !== 'View2') {
            updateHeatmap(data);
        }
    }

    Observer.addView(view2);
    return view2;
}
