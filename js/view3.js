function View3(Observer) {
    var view3 = {};
    var $bmDiv = $("#view3");
    var margin = { top: 20, right: 20, bottom: 20, left: 20 };
    var width = $bmDiv.width(), height = $bmDiv.height();
    var graphWidth = width - margin.left - margin.right;
    var graphHeight = height - margin.top - margin.bottom;
    
    var tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('position', 'absolute')
        .style('opacity', 0)
        .style('background-color', 'white')
        .style('border', '1px solid #ccc')
        .style('padding', '10px')
        .style('border-radius', '4px')
        .style('pointer-events', 'none');
    
    var svg = d3.select("#view3")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("class", "view3_svg");
    
    var svg_g_map = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    var svg_g_circles = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    var svg_g_agglomerations = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    var projection = d3.geoMercator()
        .scale(370)
        .center([20, 0])
        .translate([graphWidth / 2, graphHeight / 2]);
    var path = d3.geoPath().projection(projection);
    
    var currentYear = 2020;
    let countryData = [];
    let agglomerationData = [];
    let geoData;
    let filteredFeatures = [];
    
    d3.json("./json/Africa.geojson").then(function(data) {
        geoData = data;
        loadCSVData();
    });

    function zoomed(event) {
        const minScale = 0.2; 
        const maxScale = 10;

        let transform = event.transform;
        transform.k = Math.min(maxScale, Math.max(minScale, transform.k));

        svg_g_map.attr("transform", `translate(${transform.x}, ${transform.y}) scale(${transform.k})`);
        svg_g_circles.attr("transform", `translate(${transform.x}, ${transform.y}) scale(${transform.k})`);
        svg_g_agglomerations.attr("transform", `translate(${transform.x}, ${transform.y}) scale(${transform.k})`);
    }
    
    function loadCSVData() {
        d3.csv("./data/country_cleaned.csv", d3.autoType).then(function(data) {
            countryData = data;
            filteredFeatures = geoData.features.filter(d => {
                var countryName = d.properties.name;
                return countryData.some(c => c.Country === countryName);
            });
            loadAgglomerationData()
            initialize();
        });
    }
    
    function loadAgglomerationData() {
        d3.csv("./data/agglomeration_cleaned.csv", d3.autoType).then(function(data) {
            agglomerationData = data;
            initializeAgglomerations();
        });
    }
    
    function drawMapShapes() {
        svg_g_map.selectAll("path.map")
            .data(geoData.features)
            .join("path")
            .attr("class", "map")
            .attr("d", path)
            .attr("fill", "#232323")
            .attr("stroke", "#999")
            .attr("stroke-width", 0.5);
    }
    
    function initializeCircles() {
        var tpopField = "TPOP" + currentYear;
        var urbanField = "Urbanlevel" + currentYear;
        svg_g_circles.selectAll(".country-circle")
            .data(filteredFeatures)
            .join("g")
            .attr("class", "country-circle")
            .attr("transform", d => {
                var centroid = path.centroid(d);
                return `translate(${centroid[0]}, ${centroid[1]})`;
            })
            .each(function(d) {
                var countryName = d.properties.name;
                let record = countryData.find(c => c.Country === countryName);
                if (record && record[urbanField] != null && record[tpopField] != null) {
                    let urbanValue = parseFloat(record[urbanField].replace('%', '')) / 100;
                    if (isNaN(urbanValue)) urbanValue = 0;
                    let tpopValue = parseFloat(record[tpopField].replace(/,/g, ''));
                    if (isNaN(tpopValue)) tpopValue = 0;
                    var pieData = [
                        { urbanValue: urbanValue, tpopValue: tpopValue },
                        { urbanValue: 1 - urbanValue, tpopValue: tpopValue }
                    ];
                    var arcs = pie(pieData);
                    d3.select(this).selectAll("path")
                        .data(arcs)
                        .join("path")
                        .attr("d", arc)
                        .attr("fill", (d, i) => i === 0 ? colorScale(tpopValue) : "rgba(35, 35, 35, 0)")
                        .attr("stroke", "rgba(255, 255, 255, 0.2)")
                        .attr("stroke-width", 0.5)
                        .attr("opacity", 0.8);
                }
            })
            .on('mouseover', function(event, d) {
                var countryName = d.properties.name;
                var record = countryData.find(c => c.Country === countryName);
                if (record) {
                    var urbanField = "Urbanlevel" + currentYear;
                    var tpopField = "TPOP" + currentYear;
                    var urbanValue = record[urbanField] || 'N/A';
                    var tpopValue = record[tpopField] || 'N/A';
                    tooltip.transition()
                        .duration(200)
                        .style('opacity', 0.9);
                    tooltip.html(`<strong>${countryName}</strong><br/>
                                  Urban Level: ${urbanValue}<br/>
                                  Total Population: ${tpopValue}`)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                }
            })
            .on('mousemove', function(event) {
                tooltip.style('left', (event.pageX + 10) + 'px')
                       .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function() {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            })
            .on("click", function(event, d) {
                var countryName = d.properties.name;
                var selectedData = {
                    country: countryName,
                    year: currentYear
                };
                updateMap(selectedData)
                obs.fireEvent('countrySelected', selectedData, 'View3');
            })
            ;
    }
    
    function initializeAgglomerations() {
        svg_g_agglomerations.selectAll("circle.agglomeration-circle")
            .data(agglomerationData)
            .join("circle")
            .attr("class", "agglomeration-circle")
            .attr("cx", d => projection([d.Longitude, d.Latitude])[0])
            .attr("cy", d => projection([d.Longitude, d.Latitude])[1])
            .attr("r", d => {
                var builtField = "Built_" + currentYear;
                var builtValue = d[builtField];
                if (typeof builtValue === 'string') {
                    builtValue = builtValue.replace(/,/g, '');
                }
                builtValue = parseFloat(builtValue) || 0;
                return radiusScale2(builtValue);
            })
            // .attr("fill", "#DF6A15")
            .attr("fill", d => {
                var populationField = "Population_" + currentYear;
                var populationValue = d[populationField];
                if (populationValue) {
                    populationValue = populationValue.replace(/,/g, '');
                    populationValue = parseFloat(populationValue);
                    if (isNaN(populationValue)) {
                        populationValue = 0;
                    }
                }
                return colorScale2(populationValue);
            })
            .attr("stroke-width", 0)
            .on('mouseover', function(event, d) {
                var agglomerationName = d.Agglomeration_Name;
                var populationField = "Population_" + currentYear;
                var populationValue = d[populationField];
                if (populationValue) {
                    populationValue = populationValue.replace(/,/g, '');
                    populationValue = parseFloat(populationValue);
                }
                var builtField = "Built_" + currentYear;
                var builtValue = d[builtField];
                if (typeof builtValue === 'string') {
                    builtValue = builtValue.replace(/,/g, '');
                }
                builtValue = parseFloat(builtValue) || 0;
                var vField = "Voronoi_" + currentYear;
                var vValue = d[vField];
                if (typeof vValue === 'string') {
                    vValue = vValue.replace(/,/g, '');
                }
                vValue = parseFloat(vValue) || 0;
                tooltip.transition()
                    .duration(200)
                    .style('opacity', 0.9);
                tooltip.html(`<strong>${agglomerationName}</strong><br/>
                              Population: ${populationValue}<br/>
                              Built: ${builtValue}<br/>
                              Voronoi: ${vValue}`)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mousemove', function(event) {
                tooltip.style('left', (event.pageX + 10) + 'px')
                       .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function() {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });

        svg_g_agglomerations.selectAll("circle.agglomeration-voronoi")
            .data(agglomerationData)
            .join("circle")
            .attr("class", "agglomeration-voronoi")
            .attr("cx", d => projection([d.Longitude, d.Latitude])[0])
            .attr("cy", d => projection([d.Longitude, d.Latitude])[1])
            .attr("r", d => {
                var vField = "Voronoi_" + currentYear;
                var vValue = d[vField];
                if (typeof vValue === 'string') {
                    vValue = vValue.replace(/,/g, '');
                }
                vValue = parseFloat(vValue) || 0;
                return radiusScale2(vValue);
            })
            .attr("stroke-width", d => {
                var vField = "Voronoi_" + currentYear;
                var vValue = d[vField];
                if (vValue==0 || vValue=='-' || vValue==NaN) {
                    return(0)
                }
                else return(0.1)
            })
            .attr("fill", 'none')
            .attr("stroke", "rgba(255, 255, 255, 0.44)")
            // .attr("stroke-width", 0.1)
            .attr("stroke-dasharray", "0.5,0.5")
            .on('mouseover', function(event, d) {
                var agglomerationName = d.Agglomeration_Name;
                var populationField = "Population_" + currentYear;
                var populationValue = d[populationField];
                if (populationValue) {
                    populationValue = populationValue.replace(/,/g, '');
                    populationValue = parseFloat(populationValue);
                }
                var builtField = "Built_" + currentYear;
                var builtValue = d[builtField];
                if (typeof builtValue === 'string') {
                    builtValue = builtValue.replace(/,/g, '');
                }
                builtValue = parseFloat(builtValue) || 0;
                var vField = "Voronoi_" + currentYear;
                var vValue = d[vField];
                if (typeof vValue === 'string') {
                    vValue = vValue.replace(/,/g, '');
                }
                vValue = parseFloat(vValue) || 0;
                tooltip.transition()
                    .duration(200)
                    .style('opacity', 0.9);
                tooltip.html(`<strong>${agglomerationName}</strong><br/>
                              Population: ${populationValue}<br/>
                              Built: ${builtValue}<br/>
                              Voronoi: ${vValue}`)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mousemove', function(event) {
                tooltip.style('left', (event.pageX + 10) + 'px')
                       .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function() {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });
    }
    
    
    function updateCircles() {
        var tpopField = "TPOP" + currentYear;
        var urbanField = "Urbanlevel" + currentYear;
        svg_g_circles.selectAll(".country-circle").each(function(d) {
            var countryName = d.properties.name;
            let record = countryData.find(c => c.Country === countryName);
            if (record && record[urbanField] != null && record[tpopField] != null) {
                let urbanValue = parseFloat(record[urbanField].replace('%', '')) / 100;
                let tpopValue = parseFloat(record[tpopField].replace(/,/g, ''));
                if (isNaN(urbanValue)) urbanValue = 0;
                if (isNaN(tpopValue)) tpopValue = 0;
                var pieData = [
                    { urbanValue: urbanValue, tpopValue: tpopValue },
                    { urbanValue: 1 - urbanValue, tpopValue: tpopValue }
                ];
                var arcs = pie(pieData);
                d3.select(this)
                    .selectAll("path")
                    .data(arcs)
                    .join("path")
                    .attr("d", arc)
                    .attr("fill", (d, i) => i === 0 ? colorScale(tpopValue) : "rgba(35,35,35,0)")
                    .attr("stroke", "rgba(255, 255, 255, 0.2)")
                    .attr("stroke-width", 0.5)
                    .attr("opacity", 0.8);
            }
        });
        updateAgglomerations();
    }
    
    function updateAgglomerations() {
        var populationField = "Population_" + currentYear;
        var builtField = "Built_" + currentYear;
        var vField = "Voronoi_" + currentYear;
        svg_g_agglomerations.selectAll("circle.agglomeration-circle").each(function(d) {
            var populationValue = d[populationField];
            var builtValue = d[builtField];
            if (populationValue) {
                populationValue = populationValue.replace(/,/g, '');
                populationValue = parseFloat(populationValue);
            }
            if (!isNaN(populationValue)) {
                d3.select(this).attr("fill", colorScale2(populationValue));
            } else {
                d3.select(this).attr("fill", 'rgba(255,255,255, 0)');
            }
            if (builtValue) {
                if (typeof builtValue === 'string') {
                    builtValue = builtValue.replace(/,/g, '');
                }
                builtValue = parseFloat(builtValue) || 0;
                d3.select(this).attr("r", radiusScale2(builtValue));
            }
            else {d3.select(this).attr("r", 0.5);}
        });
        svg_g_agglomerations.selectAll("circle.agglomeration-voronoi").each(function(d) {
            var vValue = d[vField];
            if (typeof vValue === 'string') {
                vValue = vValue.replace(/,/g, '');
            }
            vValue = parseFloat(vValue) || 0;
            d3.select(this).attr("r", radiusScale2(vValue));
            if (!vValue || vValue==0 || vValue=='-' || vValue==NaN) {
                d3.select(this).attr("stroke-width", 0);
            }
            else {d3.select(this).attr("stroke-width", 0.1);}
        });
    }
    
    var pie = d3.pie()
        .value(d => d.urbanValue)
        .sort(null);
    
    var arc = d3.arc()
        .outerRadius(d => radiusScale(d.data.tpopValue))
        .innerRadius(0);
    
    // tpop
    var colorScale = d3.scaleSequential()
        .domain([0, 100000000])
        .range(["rgba(255, 221, 85, 0.5)", "rgba(255, 221, 85, 0.9)"]);

    // // agg pop
    // var colorScale2 = d3.scaleSequential()
    //     .domain([0, 100000000])
    //     .range(["rgba(223, 106, 21, 0)", "rgba(223, 106, 21, 0.8)"]);
    var thresholds = [0, 10000, 100000, 1000000, 10000000, 100000000, 1000000000]; 
    var colorScale2 = d3.scaleThreshold()
        .domain(thresholds)
            .range(["rgba(255,255,255, 0)", "rgba(18, 150, 219, 0.2)", "rgba(18, 150, 219, 0.4)", "rgba(18, 150, 219, 0.6)", "rgba(18, 150, 219, 0.8)", "rgba(18, 150, 219, 1)"]);
    
    // tpop
    var radiusScale = d3.scaleLinear()
        .domain([0, 100000000])
        .range([4, 12]);

    // agg built up, voronoi
    var radiusScale2 = d3.scaleLinear()
        .domain([0, 10, 1000000])
        .range([0, 1, 10]);
    
    // var urbanThreshold = 10000;
    // villes moyennes: <= 100000

    function createControls() {
        var sliderContainer = d3.select("#view3")
            .append("div")
            .attr("class", "slider-container")
            .style("position", "absolute")
            .style("bottom", "20px")
            .style("left", "20px")
            // .style("background", "rgba(255,255,255,0.8)")
            .style("padding", "5px")
            .style("border-radius", "3px");

        sliderContainer.append("input")
            .attr("type", "range")
            .attr("min", 1950)
            .attr("max", 2050)
            .attr("step", 10)
            .attr("value", currentYear)
            .on("input", function() {
                currentYear = +this.value;
                updateAgglomerations();
                updateCircles();
                sliderContainer.select(".time-text").text(currentYear);
            });

        sliderContainer.append("span")
            .attr("class", "time-text")
            .style("margin-left", "10px")
            .text(currentYear);
    }

    function initialize() {
        drawMapShapes();
        initializeAgglomerations();
        initializeCircles();
        createControls();
        svg.call(d3.zoom().on("zoom", zoomed));
    }

    function updateMap(selectedData) {
        selectedCountry = selectedData.country;
        selectedYear = selectedData.year;
        
        var slider = d3.select(".slider-container input");
        slider.property("value", selectedYear)
              .attr("value", selectedYear);
        
        d3.select(".time-text").text(selectedYear);
        
        slider.node().dispatchEvent(new Event('input', { bubbles: true }));
        
        svg_g_circles.selectAll(".country-circle").each(function(d) {
            var countryName = d.properties.name;
            var circle = d3.select(this);
            circle.selectAll("path").each(function() {
                if (countryName === selectedCountry) {
                    d3.select(this)
                      .attr("stroke", "rgb(255, 255, 255)")
                      .attr("stroke-width", 1);
                } else {
                    d3.select(this)
                      .attr("stroke", "rgba(255, 255, 255, 0.2)")
                      .attr("stroke-width", 0.5);
                }
            });
        });
    }
    

    // Response
    view3.onMessage = function(message, data, from){
        if (message === 'countrySelected' && from !== 'View3') {
            updateMap(data);
        }
    }
    Observer.addView(view3);
    return view3;
}

