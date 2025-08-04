function View1(Observer) {
    var view1 = {};
    var $bmDiv = $("#view1");
    var margin = { top: 20, right: 30, bottom: 40, left: 50 };
    var width = $bmDiv.width(), height = $bmDiv.height();
    var graphWidth = width - margin.left - margin.right;
    var graphHeight = height - margin.top - margin.bottom;

    var svg = d3.select("#view1")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("class", "view1");

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
    let colors = ['#F5BE68', '#BA6F8B', '#388EBF', '#76B6B1', '#9B86D3'];

    let xScale, yScale;

    function loadCSVData() {
        d3.csv("./data/country_cleaned.csv", d3.autoType).then(function(data) {
            data = data.filter(d => d.AU_Regions !== "Region" && d.AU_Regions !== "Regional entities");

            countryData = data.map(d => {
                let country = d.Country;
                let urbanLevels = years.map(year => ({
                    year: year,
                    urbanLevel: parseFloat(d[`Urbanlevel${year}`].replace('%', '')) || 0
                }));
                return { country, urbanLevels, AU_Regions: d.AU_Regions };
            });

            let regions = [...new Set(countryData.map(d => d.AU_Regions))];
            let regionData = regions.map(region => ({
                region: region,
                countries: countryData.filter(d => d.AU_Regions === region)
            }));

            createRegionButtons(regions);

            xScale = d3.scaleLinear()
                .domain([1950, 2050])
                .range([0, graphWidth]);

            yScale = d3.scaleLinear()
                .domain([0, 100])
                .range([graphHeight, 0]);

            drawLineChart(regionData);
        });
    }

    function createRegionButtons(regions) {
        let buttonContainer = d3.select("#view1")
            .append("div")
            .attr("class", "button-container")
            .style("position", "absolute")
            .style("top", "10px")
            .style("left", "60px")
            .style("display", "flex")
            .style("gap", "10px")
            .style("flex-wrap", "wrap");

        regions.forEach((region, i) => {
            let button = buttonContainer.append("button")
                .text(region)
                .style("padding", "0px 5px")
                .style("background-color", colors[i % colors.length])
                .style("color", "white")
                .style("border", "none")
                .style("border-radius", "5px")
                .style("cursor", "pointer")
                .style("font-size", "8px")
                .on("click", () => toggleRegion(region));
        });
    }

    function toggleRegion(region) {
        let regionCountries = countryData.filter(d => d.AU_Regions === region);
        let paths = svg_g.selectAll("path." + region.replace(/\s+/g, ""));

        paths.transition()
            .duration(0)
            .style("opacity", paths.style("opacity") === "0" ? "0.5" : "0");
        
    }

    function drawLineChart(regionData) {
        svg_g.append("g")
            .attr("transform", `translate(0,${graphHeight})`)
            .call(d3.axisBottom(xScale))
            .selectAll("text")
            .style("font-family", "Arial")
            .style("font-size", "12px")
            .style("fill", "white");

        svg_g.append("g")
            .call(d3.axisLeft(yScale))
            .selectAll("text")
            .style("font-family", "Arial")
            .style("font-size", "12px")
            .style("fill", "white");

        regionData.forEach((region, i) => {
            drawRegionLines(region.region, colors[i % colors.length]);
        });

        svg_g.append("text")
            .attr("x", graphWidth / 2)
            .attr("y", graphHeight + margin.bottom - 5)
            .text("Year")
            .style("font-family", "Arial")
            .style("font-size", "10px");

        svg_g.append("text")
            .attr("x", -graphHeight)
            .attr("y", -margin.left / 2)
            .attr("transform", "rotate(-90)")
            .text("Urbanization Level (%)")
            .style("font-family", "Arial")
            .style("font-size", "10px");
    }

    function drawRegionLines(region, color) {
        let regionCountries = countryData.filter(d => d.AU_Regions === region);

        regionCountries.forEach((d, i) => {
            let line = d3.line()
                .x(p => xScale(p.year))
                .y(p => yScale(p.urbanLevel));
            
            var regionClass = region.replace(/\s+/g, "");
            svg_g.append("path")
                .datum(d.urbanLevels)
                .attr("fill", "none")
                .attr("stroke", color)
                .attr("stroke-width", 1.5)
                .attr("d", line)
                .attr("class", regionClass)
                .style("opacity", 0.5)
                .on("mouseover", function(event) {
                    tooltip.transition().duration(200).style("opacity", 0.9);
                })
                .on("mousemove", function(event) {
                    let pointer = d3.pointer(event, this);
                    let x0 = xScale.invert(pointer[0]);
                    let bisect = d3.bisector(p => p.year).left;
                    let urbanLevels = d3.select(this).datum();
                    let index = bisect(urbanLevels, x0, 1);
                    let d0 = urbanLevels[index - 1];
                    let d1 = urbanLevels[index];
                    let dPoint = x0 - d0.year > d1.year - x0 ? d1 : d0;
                
                    let countryDataItem = regionCountries.find(country => country.urbanLevels === urbanLevels);
                    let country = countryDataItem ? countryDataItem.country : '';
                
                    tooltip.html(`${country}<br>Year: ${dPoint.year}<br>Urbanlevel: ${dPoint.urbanLevel.toFixed(2)}%`)
                        .style("left", `${event.pageX + 10}px`)
                        .style("top", `${event.pageY - 28}px`);
                })                
                .on("mouseout", function() {
                    tooltip.transition().duration(500).style("opacity", 0);
                })
                .on("click", function(event) {
                    let pointer = d3.pointer(event, this);
                    let x0 = xScale.invert(pointer[0]);
                    let bisect = d3.bisector(p => p.year).left;
                    let urbanLevels = d3.select(this).datum();
                    let index = bisect(urbanLevels, x0, 1);
                    let d0 = urbanLevels[index - 1];
                    let d1 = urbanLevels[index];
                    let clickedPoint = x0 - d0.year > d1.year - x0 ? d1 : d0;
                    
                    let countryDataItem = regionCountries.find(country => country.urbanLevels === urbanLevels);
                    let country = countryDataItem ? countryDataItem.country : '';
                
                    Observer.fireEvent("countrySelected", { country: country, year: clickedPoint.year }, "View1");
                });                

        });
    }

    loadCSVData();

    // Response
    view1.onMessage = function(message, data, from){

    }

    Observer.addView(view1);
    return view1;
}