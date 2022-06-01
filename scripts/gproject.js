// globals, can be adjusted later
var svg_globe, svg_line, svg_scatter, svg_innovate;
var globeWidth, globeHeight, globeInnerHeight, globeInnerWidth;
var innoWidth, innoHeight, innoInnerWidth, innoInnerHeight;
var margin = { top: 50, right: 60, bottom: 60, left: 100 };
var mapData, covidData;

// This will run when the page loads
document.addEventListener('DOMContentLoaded', () => {
    svg_globe = d3.select('#chorograph');
    svg_circle = d3.select('#circlechart');
    svg_scatter = d3.select('#scatterplot');
    svg_innovate = d3.select('#innovative');

    // may need to be tweaked later for consistent styling, leaving as is for now
    globeWidth = +svg_globe.style('width').replace('px','');
    globeHeight = +svg_globe.style('height').replace('px','');;
    globeInnerWidth = globeWidth - margin.left - margin.right;
    globeInnerHeight = globeHeight - margin.top - margin.bottom;

    // styling for innovative chart
    innoWidth = +svg_innovate.style('width').replace('px','');
    innoHeight = +svg_innovate.style('height').replace('px','');;
    innoInnerWidth = innoWidth - margin.left - margin.right;
    innoInnerHeight = innoHeight - margin.top - margin.bottom;

   
    
    // Load the COVID .csv and world map data
    Promise.all([d3.json('data/world.geojson'),
                 d3.csv('data/covid.csv')])
                 .then(function(values){

        mapData = values[0];
        covidData = values[1];
        d3.select('tooltip').attr('hidden',true);
        // logging data for debug purposes
        //console.log("Here's the mapData:");
        //console.log(mapData);
        //console.log("Here's the covidData:")
        //console.log(covidData);       

        // need to remove that weird Cases_on_an_international_conveyance_Japan item
        covidData = covidData.filter(d => +d["Location.Country"] != "Cases_on_an_international_conveyance_Japan" );

        covidData.map(function(d) {
            d["cases"] = +d["Data.Cases"];
            d["deaths"] = +d["Data.Deaths"];
            d["country"] = +d["Location.Country"];
            d["region"] = +d["Location.Continent"];

            d["value"] = +d["Data.Population"];
        });
     
        drawCharts();
        drawCircles();
       
    });    
});


function drawCharts() {
    let worldProjection =  d3.geoEquirectangular()
                          .fitSize([+svg_globe.style('width').replace('px',''),
                                    +svg_globe.style('width').replace('px','')], 
                                    mapData);

    //taken from sample code
    worldProjection       
        .fitSize([globeWidth-50,globeHeight-50], mapData)
        .translate([globeWidth/2, globeHeight/2]);

    let geoPath = d3.geoPath()
                    .projection(worldProjection);

    
    //filter data by day/month/year
    //not all dates will have data - don't be scared if the array is empty
    let selectedDay = 1;
    selectedDay = d3.select('#day-input').property('value');
    let selectedMonth = 1;
    selectedMonth = d3.select('#month-input').property('value');
    console.log(selectedMonth);
    let selectedYear = 2019;
    selectedYear = d3.select('#year-input').property('value');
    console.log(selectedYear);

    let yearData = covidData.filter( d => +d["Date.Year"] == selectedYear);
    let monthData = yearData.filter( d => +d["Date.Month"] == selectedMonth);
    let dayData = monthData.filter(d => +d["Date.Day"] == selectedDay);

    //console.log("Here's the filtered data for the color map");
    //console.log(dayData);    

    // Get the min and max value for the selected attribute based on the currently selected date and data
    let attribute = d3.select('#attribute-select').property('value');
    let extent = d3.extent(dayData, function(d) { return d[attribute] });

    // choosing a blue monochromatic scale for now!
    let colorScale = d3.scaleSequential(d3.interpolateBlues)
                        .domain(extent);

    // Clean the map
    svg_globe.selectAll('*').remove();

    svg_globe.selectAll('.country')
                .data(mapData.features)
                .join(
                    enter => {
                        enter.append('path')
                            .classed('country',true)
                            //.attr('vector-effect','non-scaling-stroke')
                            .attr('d', geoPath)
                            .attr('id', d => {
                                return d.properties.name;
                            })
                            .attr('fill', d=> {
                                let targetName = d.properties.name;
                                targetName = targetName.replaceAll(' ', '_');
                                //console.log(targetName);
                                let target = dayData.filter(function(d) {
                                    return (d["Location.Country"] == targetName);
                                });
                                if (typeof target[0] !== 'undefined') {
                                    return colorScale(parseFloat(target[0][attribute]));
                                }
                                else {
                                    return 'gray';
                                }
                            })
                            .on('mouseover', function(d,i) {
                                //console.log(`Mouseover on ${d.properties.name}`);
                                d3.select(this).classed('countrySelected', true);
                            })
                            .on('mouseout', function(d,i) {
                                //console.log(`Mouseout on ${d.properties.name}`);
                                d3.select(this).classed('countrySelected', false);
                                d3.select(this).classed('country', true);
                            })
                            .on('click', function(d,i) {
                                //console.log(`Click on ${d.properties.name}`);
                                console.log(this);
                                drawInnovative(this.id.replaceAll(' ', '_'), attribute);
                            })
                    }
                );

    let g_c = svg_globe.append('g');

    drawColorScale(g_c, attribute, colorScale);
//scatter
    /*
        6. Create our x and y scales.
    */
    const xScale = d3.scaleLinear()
                    .domain([0, d3.max(dayData, d => d["cases"])]) // data space
                    .range([0, globeInnerWidth]); // pixel space
    const yScale = d3.scaleLinear()
                    .domain([0, d3.max(dayData, d => d["deaths"])]) // data space
                    .range([globeInnerHeight, 0 ]); // pixel space

    /*
        7. Clear anything currently drawn on our svg. 
           Try commenting this out and seeing what happens 
           when you update the scatter plot.
    */
           svg_scatter.select('g').remove();
    
    /*
        8. Draw the scatter plot circles.
            You can swap the color scales being used by commenting/uncommenting 
            the .style('fill',...) lines.
    */

            var myColor = d3.scaleOrdinal(d3.schemeCategory10)

            var div = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

    const g = svg_scatter.append('g')
                .attr('transform', 'translate('+margin.left+', '+margin.top+')');;
    g.selectAll('circle')
     .data(dayData)
     .enter()
     .append('circle')
     .attr('id', d => {
         return d["Location.Country"];
     })
     .attr('cx', d => xScale(d["cases"]))
     .attr('cy', d => yScale(d["deaths"]))
     .attr('r', 10)
    //  .style('opacity',.6)    // you can uncomment this line to make the points semi-opaque, but it can lead to separability issues with the color scale
     .style('fill', d => myColor(d["cases"]))
    //  .style('fill', d => colorScaleProvided(d[cAttrib]))
     .style('stroke','gray')
     .on('mouseover', function(event,d) {
        //console.log(`Mouseover on ${d.properties.name}`);
        d3.select(this)
                .style("stroke-width", 4);
        div.transition()
               .duration(50)
               .style("opacity", 1);
         let text  = "Country: "+ d["Location.Country"] + "<br>" + "Date: " + selectedMonth + "/" + selectedDay + "/" + selectedYear + "<br>" + "Cases: " + d.cases + "<br>" + "Deaths: " + d.deaths;
               div.html(text)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 15) + "px");
    })
    .on('click', function(d,i){
        //console.log(d3.select(this));
        d3.select(this.id);
        //console.log(this.id);
        drawInnovative(this.id.replaceAll(' ', '_'),"Data.Rate");

    })
    .on('mouseout', function(d,i) {
        //console.log(`Mouseout on ${d.properties.name}`);
        d3.select(this)
                .style("stroke-width", 1);
                div.transition()
                .duration(50)
                .style("opacity", 0);
    });

    
    /*
        10. Draw the scatterplot's x and y axes and add label axes
    */
    const yAxis = d3.axisLeft(yScale);
    g.append('g').call(yAxis);
    const xAxis = d3.axisBottom(xScale);
    g.append('g').call(xAxis)
                    .attr('transform',`translate(0,${globeInnerHeight})`)
    g.append('text')
        .attr('x',globeInnerWidth/2)
        .attr('y',globeInnerHeight+40)
        .text("Cases");
    g.append('text')
        .attr('transform','rotate(-90)')
        .attr('y','-40px')
        .attr('x',-globeInnerHeight/2)
        .attr('text-anchor','middle')
        .text("Deaths")

}


// borrowing from homework 3
function drawColorScale(g, attribute, colorScale) {
    const linearGradient = g.append("defs")
                            .append("linearGradient")
                            .attr("id", "linear-gradient");
    linearGradient.selectAll("stop")
                  .data(colorScale.ticks()
                  .map((t, i, n) => ({ 
                    offset: `${100*i/n.length}%`, 
                    color: colorScale(t) })))
                  .enter()
                    .append("stop")
                    .attr("offset", d => d.offset)
                    .attr("stop-color", d => d.color);
    g.append("rect")
     .attr('transform', `translate(100,650)`)
     .attr("width", 400)
     .attr("height", 20)
     .style("fill", "url(#linear-gradient)");
    const colorAxis = d3.axisBottom(d3.scaleLinear()
                        .domain(colorScale.domain())
                        .range([0,400]))
                        .ticks(5).tickSize(-20);

    g.append('g').call(colorAxis)
     .attr('class','colorLegend')
     .attr('transform','translate(100,670)')
     .selectAll('text')
     .style('text-anchor','end')
     .attr('dx','-10px')
     .attr('dy', '0px')
     .attr('transform','rotate(-45)');
    g.append('text')
     .attr('x',100)
     .attr('y',645)
     .style('font-size','.9em')
     .text(attribute);
}


function drawInnovative(country, attribute) {
    console.log("drawInnovative called for: ");
    console.log(country);

    var country_name = country.replaceAll('_', ' ');;
    
    // Grab the current month/day/year again
    let selectedDay = 1;
    selectedDay = d3.select('#day-input').property('value');
    console.log(selectedDay);
    let selectedMonth = 1;
    selectedMonth = d3.select('#month-input').property('value');
    console.log(selectedMonth);
    let selectedYear = 2019;
    selectedYear = d3.select('#year-input').property('value');
    console.log(selectedYear);

    // get exactly the day for the country
    let yearData = covidData.filter( d => +d["Date.Year"] == selectedYear);
    let monthData = yearData.filter( d => +d["Date.Month"] == selectedMonth);
    let dayData = monthData.filter(d => +d["Date.Day"] == selectedDay);
    let target = dayData.filter(d => d["Location.Country"] == country);

    console.log(target);

    // if we have no data for this country/this day, draw an empty circle and return
    if (typeof target[0] == 'undefined') {
        svg_innovate.selectAll('*').remove();

        const g_i = svg_innovate.append('g')
                    .attr('transform', 'translate('+margin.left+', '+margin.top+')');
    
        g_i.append('circle')
            .attr('cx', 450)
            .attr('cy', 300)
            .attr('r', 150)
            .attr('stroke', 'black')
            .attr('fill', 'lightgrey');
    
        return;
    }


    // Get the min and max value for the selected attribute based on the currently selected date and data
    //let attribute = d3.select('#attribute-select').property('value');
    
    // extent for the entire dataset of that attribute
    let extent = d3.extent(covidData, function(d) { return d[attribute] });
    console.log(extent);

    // Draw a circle, that's the earth
    innerInnerRadius = 140;
    innerRadius = 150;

    var arc = d3.arc()
                .innerRadius(innerRadius)
                .outerRadius(innerRadius + 1)
                .startAngle(100)
                .endAngle(2 * 180);    

    // generate array of [x,y] coords for placing dots, triangles randomly(?)

    // determine how many triangles we will need
    let attributeToTriangles = d3.scaleLinear()
                                    .domain(extent) // the extent of the covid attribute
                                    .range([0, 100]) // 0 to 100 triangles
                                    .nice();
    
    var numberTriangles;
    if (target[0][attribute] == 0) {
        numberTriangles = 0;
    }
    else {
        numberTriangles = parseInt(attributeToTriangles(target[0][attribute]));
    }

    console.log("Value of selected attribute is:");
    console.log(target[0][attribute]);
    console.log("We will need this many triangles to cover the circle:");
    console.log(numberTriangles);

    const trianglePosArray = [];
    
    var theta = (Math.PI * 2) / numberTriangles;

    for (i = 1; i <= numberTriangles; i++) {
        var angle = theta * i;
        var c_x = parseInt(Math.random() * innerInnerRadius * Math.cos(angle));
        var c_y = parseInt(Math.random() * innerInnerRadius * Math.sin(angle));
        trianglePosArray.push([c_x + 450, c_y + 300]);
    }

    console.log(trianglePosArray);

    var symbolGenerator = d3.symbol()
        .type(d3.symbolTriangle)
        .size(200);
    
    var triangleData = symbolGenerator();

    // clean the graph
    svg_innovate.selectAll('*').remove();

    const g_i = svg_innovate.append('g')
                 .attr('transform', 'translate('+margin.left+', '+margin.top+')');
    
    g_i.append('circle')
        .attr('cx', 450)
        .attr('cy', 300)
        .attr('r', 150)
        .attr('stroke', 'black')
        .attr('fill', 'lightgrey');

    g_i.selectAll('path')
        .data(trianglePosArray)
        .join('path')
        .attr('transform', function(d) {
            return 'translate(' + d + ')';
        })
        .attr('d', triangleData)
        .attr('stroke', 'brown')
        .attr('fill', 'red');

    // create and append text for more user information
    g_i.append("text")
        .attr("x", innoInnerWidth/2 - 25)
        .attr("y", margin.top)
        .text(country_name)
        .style("font-size", "14px")

    g_i.append("text")
        .attr("x", 10)
        .attr("y", margin.top+530)
        .text(attribute + " represented as a COVID molecule for the date \n " + selectedMonth + "/" + selectedDay + "/" + selectedYear)
        .style("font-size", "14px")
    
    g_i.append("text")
        .attr("x", 10)
        .attr("y", margin.top+550)
        .text(attribute + " was " + target[0][attribute] + " on this day.")
        .style("font-size", "14px")


    
}



function drawCircles(){

    let selectedDay = 1;
    selectedDay = d3.select('#day-input').property('value');
    console.log(selectedDay);
    let selectedMonth = 1;
    selectedMonth = d3.select('#month-input').property('value');
    console.log(selectedMonth);
    let selectedYear = 2019;
    selectedYear = d3.select('#year-input').property('value');
    console.log(selectedYear);

    // get exactly the day for the country
    let yearData = covidData.filter( d => +d["Date.Year"] == selectedYear);
    let monthData = yearData.filter( d => +d["Date.Month"] == selectedMonth);
    let dayData = monthData.filter(d => +d["Date.Day"] == selectedDay);
    

    var div = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);
// append the svg object to the body of the page
var width = 1000
var height = 750

covidDataCircle = covidData.filter(function(d){ return d.deaths> 1000})
//covidData = covidData.slice(1000,1200);


svg_circle.append("svg")
    .attr("width", width)
    .attr("height", height)

    // Color palette for country
  var color = d3.scaleOrdinal()
    .domain(["Asia", "Europe", "Africa", "Oceania", "America"])
    .range(d3.schemeSet3);

 // Size scale for countries
 var size = d3.scaleLinear()
    .domain([0, 5000])
    .range([5,56])  // circle will be between 7 and 55 px wide

 // create a tooltip
 var Tooltip = d3.select("#circlechart")
    .append("div")
    .style("opacity", 0)
    .attr("class", "tooltip")
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "2px")
    .style("border-radius", "5px")
    .style("padding", "5px")

  // Three function that change the tooltip when user hover / move / leave a cell
  const mouseover = function(event, d) {
    d3.select(this)
    .style("stroke-width", 4);
    div.transition()
               .duration(50)
               .style("opacity", 1);
         let text  = "Country: " +  d["Location.Country"]+ "<br>" + "Deaths: " + d.deaths + "<br>" + "DeathRate: " + d3.format(".2f")(d.deaths/d.cases*100) + "%";
               div.html(text)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 15) + "px");
  }
  const mousemove = function(event, d) {
    Tooltip
    .html('<u>' + d.country + '</u>' + "<br>" + d.deaths + " Deaths")
      .style("left", (event.x/2+20) + "px")
      .style("top", (event.y/2-30) + "px")
  }
  var mouseleave = function(event, d) {
    d3.select(this)
    .style("stroke-width", 1);
    div.transition()
    .duration(50)
    .style("opacity", 0);
  }

  
  const mouseclick = function(event,d){
        console.log(d3.select(this));
        //console.log(covidDataCircle);
       countryN = d["Location.Country"];
       //deathCir
        drawInnovative(countryN,"Data.Deaths");
        //drawInnovative(d.[]);

  }

  // Initialize the circle: all located at the center of the svg area
  var node = svg_circle.append("g")
    .selectAll("circle")
    .data(covidDataCircle)
    .join("circle")
      .attr("class", "node")
    //   .attr('id', d => {
    //     return d.properties.name; 
    //   })
      .attr("r", d => size(d.deaths))
      .attr("cx", width / 2)
      .attr("cy", height / 2)
      .style("fill", d => color(d.region))
      .style("fill-opacity", 0.8)
      .attr("stroke", "black")
      .style("stroke-width", 1)
      .on("mouseover", mouseover) // What to do when hovered
      .on("mousemove", mousemove)
      .on("mouseleave", mouseleave)
      .on("click", mouseclick)
      .call(d3.drag() // call specific function when circle is dragged
           .on("start", dragstarted)
           .on("drag", dragged)
           .on("end", dragended));


  // Features of the forces applied to the nodes:
  const simulation = d3.forceSimulation()
      .force("center", d3.forceCenter().x(width / 2).y(height / 2)) // Attraction to the center of the svg area
      .force("charge", d3.forceManyBody().strength(.1)) // Nodes are attracted one each other of value is > 0
      .force("collide", d3.forceCollide().strength(.2).radius(function(d){ return (size(d.deaths)+2.5) }).iterations(1)) // Force that avoids circle overlapping

  // Apply these forces to the nodes and update their positions.
  // Once the force algorithm is happy with positions ('alpha' value is low enough), simulations will stop.
  simulation
      .nodes(covidDataCircle)
      .on("tick", function(d){
        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
      });

  // What happens when a circle is dragged?
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(.03).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(.03);
    d.fx = null;
    d.fy = null;
  }




}
